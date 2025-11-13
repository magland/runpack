"""Figpack NWB Video Preview job handler for ImageSeries visualization."""

import threading
import time
from datetime import datetime
from typing import Any, Callable, Dict

from .base import JobHandler


class FigpackNwbVideoPreviewJob(JobHandler):
    """Generate a video preview from NWB ImageSeries and upload to figurl."""
    
    def execute(self, input_params: Dict[str, Any], heartbeat_callback: Callable) -> Dict[str, Any]:
        """Execute the figpack NWB video preview job.
        
        Args:
            input_params: Must contain:
                - 'nwb_url' (str): URL to the NWB file
                - 'image_series_path' (str): Path to ImageSeries in NWB file
            heartbeat_callback: Function to send heartbeats
            
        Returns:
            Dictionary with the figurl URL for the video preview
            
        Raises:
            ValueError: If required parameters are missing or invalid
            Exception: If visualization generation or upload fails
        """
        # Validate input parameters
        if 'nwb_url' not in input_params:
            raise ValueError("Missing required parameter: 'nwb_url'")
        
        if 'image_series_path' not in input_params:
            raise ValueError("Missing required parameter: 'image_series_path'")
        
        nwb_url = input_params['nwb_url']
        image_series_path = input_params['image_series_path']
        
        # Validate parameter types
        if not isinstance(nwb_url, str):
            raise ValueError(f"Parameter 'nwb_url' must be a string, got {type(nwb_url).__name__}")
        
        if not isinstance(image_series_path, str):
            raise ValueError(f"Parameter 'image_series_path' must be a string, got {type(image_series_path).__name__}")
        
        # Validate URL format
        if not nwb_url.startswith(('http://', 'https://')):
            raise ValueError(f"Parameter 'nwb_url' must be a valid HTTP/HTTPS URL, got: {nwb_url}")
        
        # Validate image series path format
        if not image_series_path.startswith('/'):
            raise ValueError(f"Parameter 'image_series_path' must start with '/', got: {image_series_path}")
        
        # Build console output with timestamps
        console_lines = []
        console_lock = threading.Lock()
        
        def log(message: str):
            """Add a timestamped log message (thread-safe)."""
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            line = f"[{timestamp}] {message}"
            with console_lock:
                console_lines.append(line)
        
        # Import required libraries
        log("Importing required libraries...")
        try:
            import lindi
            import numpy as np
            import figpack_experimental.views as jv
        except ImportError as e:
            raise ImportError(f"Failed to import required libraries. Please install lindi, numpy, and figpack_experimental: {e}")
        
        # Setup heartbeat thread
        stop_heartbeat = threading.Event()
        heartbeat_interval = 30  # seconds
        
        def heartbeat_worker():
            """Worker function that sends periodic heartbeats."""
            while not stop_heartbeat.is_set():
                with console_lock:
                    current_console = '\n'.join(console_lines)
                
                heartbeat_callback(
                    progress_current=None,  # Unknown progress for blocking operations
                    progress_total=None,
                    console_output=current_console
                )
                
                # Wait for the next interval or until stopped
                stop_heartbeat.wait(timeout=heartbeat_interval)
        
        # Start heartbeat thread
        log("Starting heartbeat thread...")
        heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
        heartbeat_thread.start()
        
        try:
            # Load the remote NWB file
            log(f"Loading NWB file from: {nwb_url}")
            try:
                f = lindi.LindiH5pyFile.from_hdf5_file(nwb_url)
                log("Successfully loaded NWB file")
            except Exception as e:
                log(f"Failed to load NWB file: {str(e)}")
                raise Exception(f"Failed to load NWB file: {e}")
            
            # Load the ImageSeries object
            log(f"Loading ImageSeries from path: {image_series_path}")
            try:
                X = f[image_series_path]
                log("Successfully loaded ImageSeries object")
            except Exception as e:
                log(f"Failed to load ImageSeries: {str(e)}")
                raise Exception(f"Failed to load ImageSeries from path '{image_series_path}': {e}")
            
            # Extract metadata
            log("Extracting metadata...")
            try:
                starting_time = X['starting_time'][()]
                rate = X['starting_time'].attrs['rate']
                data = X['data']
                data_shape = data.shape
                
                log(f"Starting time: {starting_time}")
                log(f"Rate: {rate} Hz")
                log(f"Data shape: {data_shape}")
            except Exception as e:
                log(f"Failed to extract metadata: {str(e)}")
                raise Exception(f"Failed to extract ImageSeries metadata: {e}")
            
            # Limit to 1000 frames for preview
            max_frames = 1000
            num_frames = min(data_shape[0], max_frames)
            log(f"Processing {num_frames} frames (limited to {max_frames} for preview)")
            
            # Load and process data
            log("Loading image data...")
            try:
                if num_frames < data_shape[0]:
                    data_subset = data[:num_frames, :, :]
                else:
                    data_subset = data[:, :, :]
                
                # Convert to numpy array
                data_array = np.array(data_subset)
                log(f"Loaded data array with shape: {data_array.shape}")
            except Exception as e:
                log(f"Failed to load image data: {str(e)}")
                raise Exception(f"Failed to load image data: {e}")
            
            # Scale to 0-255 using 99th percentile normalization
            log("Scaling data to 0-255...")
            try:
                pct_99 = np.percentile(data_array, 99)
                log(f"99th percentile: {pct_99}")
                data_array = np.clip(data_array, 0, pct_99)
                data_array = ((data_array / pct_99) * 255).astype(np.uint8)
                log("Successfully scaled data")
            except Exception as e:
                log(f"Failed to scale data: {str(e)}")
                raise Exception(f"Failed to scale image data: {e}")
            
            # Convert to RGB format (T x H x W x 3)
            log("Converting to RGB format...")
            try:
                # data_array is currently T x H x W
                # Add RGB channels (grayscale)
                data_rgb = np.repeat(data_array[:, :, :, np.newaxis], 3, axis=3)
                log(f"RGB data shape: {data_rgb.shape}")
            except Exception as e:
                log(f"Failed to convert to RGB: {str(e)}")
                raise Exception(f"Failed to convert to RGB format: {e}")
            
            # Create LossyVideo
            log("Creating LossyVideo...")
            try:
                fps = min(rate, 30)  # Cap at 30 fps for reasonable playback
                log(f"Using {fps} fps for video")
                v = jv.LossyVideo(data_rgb, fps=fps)
                log("Successfully created LossyVideo")
            except Exception as e:
                log(f"Failed to create LossyVideo: {str(e)}")
                raise Exception(f"Failed to create LossyVideo: {e}")
            
            # Upload and get URL
            log("Uploading video to figurl...")
            log("This may take several minutes depending on data size...")
            
            try:
                url = v.show(
                    title='Video Preview from NWB ImageSeries',
                    upload=True,
                    open_in_browser=False
                )
                log(f"Successfully uploaded! URL: {url}")
            except Exception as e:
                log(f"Failed to upload: {str(e)}")
                raise Exception(f"Failed to upload video to figurl: {e}")
            
            # Job completed
            log("Completed!")
            
        finally:
            # Stop heartbeat thread
            log("Stopping heartbeat thread...")
            stop_heartbeat.set()
            heartbeat_thread.join(timeout=5)
        
        # Send final heartbeat with complete console output
        final_console = '\n'.join(console_lines)
        heartbeat_callback(
            progress_current=100,
            progress_total=100,
            console_output=final_console
        )
        
        # Return result with the figurl URL (without console_output)
        return {
            'figpack_url': url,
            'nwb_url': nwb_url,
            'image_series_path': image_series_path,
            'num_frames': num_frames
        }

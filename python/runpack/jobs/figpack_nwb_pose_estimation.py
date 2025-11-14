"""Figpack NWB Pose Estimation job handler for pose tracking data visualization."""

import threading
import json
import time
from datetime import datetime
from typing import Any, Callable, Dict

from .base import JobHandler


class FigpackNwbPoseEstimationJob(JobHandler):
    """Generate a pose estimation visualization from NWB pose tracking data and upload to figurl."""
    
    def execute(self, input_params: Dict[str, Any], heartbeat_callback: Callable) -> Dict[str, Any]:
        """Execute the figpack NWB pose estimation job.
        
        Args:
            input_params: Must contain:
                - 'nwb_url' (str): URL to the NWB file
                - 'path' (str): Path to pose estimation data in NWB file 
                  (e.g., '/processing/behavior/PoseEstimationLeftCamera')
            heartbeat_callback: Function to send heartbeats
            
        Returns:
            Dictionary with the figurl URL for the pose estimation visualization
            
        Raises:
            ValueError: If required parameters are missing or invalid
            Exception: If visualization generation or upload fails
        """
        # Validate input parameters
        if 'nwb_url' not in input_params:
            raise ValueError("Missing required parameter: 'nwb_url'")
        
        if 'path' not in input_params:
            raise ValueError("Missing required parameter: 'path'")
        
        dandiset_id = input_params.get('dandiset_id', '')
        neurosift_url = input_params.get('neurosift_url', '')
        
        nwb_url = input_params['nwb_url']
        path = input_params['path']
        
        # Validate parameter types
        if not isinstance(nwb_url, str):
            raise ValueError(f"Parameter 'nwb_url' must be a string, got {type(nwb_url).__name__}")
        
        if not isinstance(path, str):
            raise ValueError(f"Parameter 'path' must be a string, got {type(path).__name__}")
        
        # Validate URL format
        if not nwb_url.startswith(('http://', 'https://')):
            raise ValueError(f"Parameter 'nwb_url' must be a valid HTTP/HTTPS URL, got: {nwb_url}")
        
        # Validate path format
        if not path.startswith('/'):
            raise ValueError(f"Parameter 'path' must start with '/', got: {path}")
        
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
            import figpack_nwb.views as fpn
        except ImportError as e:
            raise ImportError(f"Failed to import required libraries. Please install figpack_nwb: {e}")
        
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
            # Create pose estimation view from NWB file
            log(f"Loading NWB file from: {nwb_url}")
            log(f"Pose estimation path: {path}")
            log("This may take several minutes for large files...")
            
            try:
                view = fpn.PoseEstimation(
                    nwb=nwb_url,
                    path=path,
                    use_local_cache=True
                )
                log("Successfully created PoseEstimation view")
            except Exception as e:
                log(f"Failed to create PoseEstimation view: {str(e)}")
                raise Exception(f"Failed to create PoseEstimation view from NWB file: {e}")
            
            # Upload and get URL
            log("Uploading pose estimation to figurl...")
            log("This may take several minutes depending on data size...")
            
            try:
                url = view.show(
                    title='RUNPACK: Pose Estimation from NWB',
                    description=json.dumps({
                        'dandiset_id': dandiset_id,
                        'neurosift_url': neurosift_url,
                        'nwb_url': nwb_url,
                        'path': path,
                    }),
                    upload=True,
                    wait_for_input=False
                )
                log(f"Successfully uploaded! URL: {url}")
            except Exception as e:
                log(f"Failed to upload: {str(e)}")
                raise Exception(f"Failed to upload pose estimation to figurl: {e}")
            
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
        
        # Return result with the figurl URL
        return {
            'figpack_url': url,
            'nwb_url': nwb_url,
            'dandiset_id': dandiset_id,
            'neurosift_url': neurosift_url,
            'path': path,
            'console_output': final_console
        }

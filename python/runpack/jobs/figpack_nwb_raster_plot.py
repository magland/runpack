"""Figpack NWB Raster Plot job handler for NWB units data visualization."""

import threading
import json
from datetime import datetime
from typing import Any, Callable, Dict

from .base import JobHandler


class FigpackNwbRasterPlotJob(JobHandler):
    """Generate a raster plot from NWB units table and upload to figurl."""
    
    def execute(self, input_params: Dict[str, Any], heartbeat_callback: Callable) -> Dict[str, Any]:
        """Execute the figpack NWB raster plot job.
        
        Args:
            input_params: Must contain:
                - 'nwb_url' (str): URL to the NWB file
                - 'units_path' (str): Path to units table in NWB file (e.g., '/units')
            heartbeat_callback: Function to send heartbeats
            
        Returns:
            Dictionary with the figurl URL for the raster plot
            
        Raises:
            ValueError: If required parameters are missing or invalid
            Exception: If visualization generation or upload fails
        """
        # Validate input parameters
        if 'nwb_url' not in input_params:
            raise ValueError("Missing required parameter: 'nwb_url'")
        
        if 'units_path' not in input_params:
            raise ValueError("Missing required parameter: 'units_path'")
        
        dandiset_id = input_params.get('dandiset_id', '')
        neurosift_url = input_params.get('neurosift_url', '')
        
        nwb_url = input_params['nwb_url']
        units_path = input_params['units_path']
        
        # Validate parameter types
        if not isinstance(nwb_url, str):
            raise ValueError(f"Parameter 'nwb_url' must be a string, got {type(nwb_url).__name__}")
        
        if not isinstance(units_path, str):
            raise ValueError(f"Parameter 'units_path' must be a string, got {type(units_path).__name__}")
        
        # Validate URL format
        if not nwb_url.startswith(('http://', 'https://')):
            raise ValueError(f"Parameter 'nwb_url' must be a valid HTTP/HTTPS URL, got: {nwb_url}")
        
        # Validate units path format
        if not units_path.startswith('/'):
            raise ValueError(f"Parameter 'units_path' must start with '/', got: {units_path}")
        
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
            from figpack import FigpackView
            import figpack_spike_sorting.views as fps
        except ImportError as e:
            raise ImportError(f"Failed to import required libraries. Please install figpack and figpack_spike_sorting: {e}")
        
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
            # Create raster plot from NWB units table
            log(f"Loading NWB file from: {nwb_url}")
            log(f"Units path: {units_path}")
            log("This may take several minutes for large files...")
            
            try:
                v: FigpackView = fps.RasterPlot.from_nwb_units_table(
                    nwb_url,
                    units_path=units_path,
                )
                log("Successfully created RasterPlot view")
            except Exception as e:
                log(f"Failed to create RasterPlot: {str(e)}")
                raise Exception(f"Failed to create RasterPlot from NWB units table: {e}")
            
            # Upload and get URL
            log("Uploading raster plot to figurl...")
            log("This may take several minutes depending on data size...")
            
            try:
                url = v.show(
                    title='RUNPACK: Raster Plot from NWB Units Table',
                    description=json.dumps({
                        'dandiset_id': dandiset_id,
                        'neurosift_url': neurosift_url,
                        'nwb_url': nwb_url,
                        'units_path': units_path,
                    }),
                    upload=True,
                    wait_for_input=False
                )
                log(f"Successfully uploaded! URL: {url}")
            except Exception as e:
                log(f"Failed to upload: {str(e)}")
                raise Exception(f"Failed to upload raster plot to figurl: {e}")
            
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
            'units_path': units_path,
            'console_output': final_console
        }

"""Hello World job handler for testing purposes."""

import time
from datetime import datetime
from typing import Any, Callable, Dict

from .base import JobHandler


class HelloWorldJob(JobHandler):
    """Simple hello world job that simulates processing time."""
    
    def execute(self, input_params: Dict[str, Any], heartbeat_callback: Callable) -> Dict[str, Any]:
        """Execute the hello world job.
        
        Args:
            input_params: Must contain 'name' (str) and 'processing_time' (float/int)
            heartbeat_callback: Function to send heartbeats
            
        Returns:
            Dictionary with greeting message and processing time
            
        Raises:
            ValueError: If required parameters are missing or invalid
        """
        # Validate input parameters
        if 'name' not in input_params:
            raise ValueError("Missing required parameter: 'name'")
        
        if 'processing_time' not in input_params:
            raise ValueError("Missing required parameter: 'processing_time'")
        
        name = input_params['name']
        processing_time = input_params['processing_time']
        
        # Validate parameter types and values
        if not isinstance(name, str):
            raise ValueError(f"Parameter 'name' must be a string, got {type(name).__name__}")
        
        if not isinstance(processing_time, (int, float)):
            raise ValueError(f"Parameter 'processing_time' must be a number, got {type(processing_time).__name__}")
        
        if processing_time < 0:
            raise ValueError(f"Parameter 'processing_time' must be non-negative, got {processing_time}")
        
        if processing_time > 300:
            raise ValueError(f"Parameter 'processing_time' must not exceed 300 seconds, got {processing_time}")
        
        # Check for optional test_exception parameter
        test_exception = input_params.get('test_exception', False)
        if not isinstance(test_exception, bool):
            raise ValueError(f"Parameter 'test_exception' must be a boolean, got {type(test_exception).__name__}")
        
        # Build console output with timestamps
        console_lines = []
        
        def log(message: str):
            """Add a timestamped log message."""
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            line = f"[{timestamp}] {message}"
            console_lines.append(line)
        
        # Start processing
        log(f"Starting hello_world job for {name}")
        log(f"Processing time: {processing_time} seconds")
        
        # Simulate processing with heartbeats every 30 seconds
        start_time = time.time()
        heartbeat_interval = 30  # seconds
        last_heartbeat = start_time
        
        while True:
            elapsed = time.time() - start_time
            
            # Check if we're done
            if elapsed >= processing_time:
                break
            
            # Send heartbeat if interval has passed
            current_time = time.time()
            if current_time - last_heartbeat >= heartbeat_interval:
                progress_current = int(elapsed)
                progress_total = int(processing_time)
                progress_percent = int((elapsed / processing_time) * 100) if processing_time > 0 else 100
                
                log(f"Progress: {progress_percent}%")
                
                # Send heartbeat
                heartbeat_callback(
                    progress_current=progress_current,
                    progress_total=progress_total,
                    console_output='\n'.join(console_lines)
                )
                
                last_heartbeat = current_time
            
            # Sleep for a short time to avoid busy waiting
            time.sleep(min(1.0, processing_time - elapsed))
        
        # Job completed
        log("Completed!")
        
        # Final console output
        final_console = '\n'.join(console_lines)
        
        # Raise test exception if requested
        if test_exception:
            log("Raising test exception as requested")
            final_console = '\n'.join(console_lines)
            raise RuntimeError("Test exception raised for testing purposes")
        
        # Return result
        return {
            'message': f"Hello, {name}!",
            'processing_time': processing_time,
            'console_output': final_console
        }

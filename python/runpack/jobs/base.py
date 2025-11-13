"""Base class for job handlers."""


class JobHandler:
    """Base class for job handlers."""
    
    def execute(self, input_params: dict, heartbeat_callback) -> dict:
        """Execute the job.
        
        Args:
            input_params: Job input parameters
            heartbeat_callback: Callback function for sending heartbeats
                               Signature: heartbeat_callback(progress_current, progress_total, console_output)
            
        Returns:
            Job result as a dictionary
            
        Raises:
            ValueError: If input parameters are invalid
            Exception: If job execution fails
        """
        raise NotImplementedError("Subclasses must implement execute()")

"""Main runner loop for executing Runpack jobs."""

import logging
import signal
import time
from typing import Optional

from .client import RunpackClient
from .config import (
    MIN_POLL_INTERVAL,
    MAX_POLL_INTERVAL,
    POLL_INTERVAL_INCREMENT,
    WORKER_URL,
    RunnerConfig,
)
from .jobs import get_job_handler, get_supported_job_types


logger = logging.getLogger(__name__)


class JobRunner:
    """Main job runner that polls for and executes jobs."""
    
    def __init__(self, api_key: str):
        """Initialize the job runner.
        
        Args:
            api_key: Runner API key for authentication
        """
        self.api_key = api_key
        self.client = RunpackClient(WORKER_URL, api_key)
        self.config = RunnerConfig()
        self.running = True
        self.current_job_id: Optional[str] = None
        self.current_poll_interval = MIN_POLL_INTERVAL
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def register(self) -> None:
        """Register the runner with the worker or load existing registration."""
        # Try to load existing configuration
        if self.config.load():
            logger.info(f"Loaded existing runner configuration: {self.config.runner_name}")
            logger.info(f"Runner ID: {self.config.runner_id}")
            self.client.runner_id = self.config.runner_id
            
            # Verify that the runner ID is still valid in the system
            logger.info("Verifying runner registration...")
            try:
                is_valid = self.client.verify_runner()
                if not is_valid:
                    raise RuntimeError(
                        f"Runner ID '{self.config.runner_id}' is not registered in the system.\n"
                        f"This can happen if the runner was deleted from the database.\n"
                        f"To fix this, delete the config file: {self.config.config_file}\n"
                        f"Then restart the runner to register with a new ID."
                    )
                logger.info("Runner registration verified successfully")
            except Exception as e:
                if isinstance(e, RuntimeError):
                    # Re-raise our custom error
                    raise
                else:
                    # Network or other error during verification
                    logger.error(f"Failed to verify runner registration: {e}")
                    raise RuntimeError(
                        f"Failed to verify runner registration: {e}\n"
                        f"Check your network connection and worker URL."
                    )
        else:
            # Generate new runner name and register
            runner_name = self.config.generate_name()
            capabilities = get_supported_job_types()
            
            runner_id = self.client.register_runner(runner_name, capabilities)
            self.config.set_runner_info(runner_id, runner_name)
            
            logger.info(f"Registered new runner: {runner_name}")
            logger.info(f"Runner ID: {runner_id}")
            logger.info(f"Capabilities: {capabilities}")
    
    def execute_job(self, job_id: str, job_type: str, input_params: dict) -> None:
        """Execute a job.
        
        Args:
            job_id: Job ID
            job_type: Type of job to execute
            input_params: Job input parameters
        """
        self.current_job_id = job_id
        logger.info(f"Executing job {job_id} of type '{job_type}'")
        
        try:
            # Get the job handler
            handler_class = get_job_handler(job_type)
            handler = handler_class()
            
            # Create heartbeat callback
            def send_heartbeat(progress_current: int, progress_total: int, console_output: str):
                """Send heartbeat to worker."""
                try:
                    self.client.send_heartbeat(
                        job_id=job_id,
                        progress_current=progress_current,
                        progress_total=progress_total,
                        console_output=console_output
                    )
                    logger.debug(f"Sent heartbeat for job {job_id}: {progress_current}/{progress_total}")
                except Exception as e:
                    logger.error(f"Failed to send heartbeat: {e}")
            
            # Execute the job
            result = handler.execute(input_params, send_heartbeat)
            
            # Extract console output from result if present
            console_output = result.pop('console_output', '')
            
            # Report successful completion
            self.client.complete_job(
                job_id=job_id,
                output_data=result,
                console_output=console_output
            )
            
            logger.info(f"Successfully completed job {job_id}")
            
        except ValueError as e:
            # Parameter validation error
            error_msg = f"Invalid parameters: {str(e)}"
            logger.error(f"Job {job_id} failed: {error_msg}")
            
            self.client.error_job(
                job_id=job_id,
                error_message=error_msg,
                console_output=error_msg
            )
            
        except Exception as e:
            # Unexpected error during execution
            error_msg = f"Job execution failed: {str(e)}"
            logger.error(f"Job {job_id} failed with exception: {e}", exc_info=True)
            
            self.client.error_job(
                job_id=job_id,
                error_message=error_msg,
                console_output=error_msg
            )
        
        finally:
            self.current_job_id = None
    
    def poll_and_execute(self) -> bool:
        """Poll for available jobs and execute them.
        
        Returns:
            True if a job was executed, False otherwise
        """
        try:
            # Get supported job types
            job_types = get_supported_job_types()
            
            # Poll for available jobs
            available_jobs = self.client.get_available_jobs(job_types)

            if not available_jobs:
                logger.debug("No jobs available")
                return False
            
            # Try to claim the first available job
            for job in available_jobs:
                job_id = job['job_id']
                
                claimed_job = self.client.claim_job(job_id)
                
                if claimed_job:
                    # Successfully claimed, execute it
                    self.execute_job(
                        job_id=claimed_job['job_id'],
                        job_type=claimed_job['job_type'],
                        input_params=claimed_job['input_params']
                    )
                    return True  # Job was executed
                else:
                    logger.debug(f"Failed to claim job {job_id}, trying next one")
            
            # No jobs were successfully claimed
            return False
        
        except Exception as e:
            logger.error(f"Error during polling: {e}", exc_info=True)
            return False
    
    def run(self) -> None:
        """Main runner loop."""
        logger.info("Starting Runpack job runner")
        logger.info(f"Worker URL: {WORKER_URL}")
        logger.info(f"Poll interval: {MIN_POLL_INTERVAL}-{MAX_POLL_INTERVAL} seconds (progressive backoff)")
        
        # Register the runner
        self.register()
        
        # Main loop
        logger.info("Entering main polling loop...")
        logger.info(f"Initial poll interval: {self.current_poll_interval} seconds")
        
        while self.running:
            try:
                job_executed = self.poll_and_execute()
                
                # Adjust polling interval based on whether a job was executed
                if job_executed:
                    # Job was executed - reset to minimum interval
                    if self.current_poll_interval != MIN_POLL_INTERVAL:
                        self.current_poll_interval = MIN_POLL_INTERVAL
                        logger.info(f"Job executed - resetting poll interval to {MIN_POLL_INTERVAL} seconds")
                else:
                    # No job executed - increase interval (with max cap)
                    old_interval = self.current_poll_interval
                    self.current_poll_interval = min(
                        self.current_poll_interval + POLL_INTERVAL_INCREMENT,
                        MAX_POLL_INTERVAL
                    )
                    if self.current_poll_interval != old_interval:
                        logger.info(f"No jobs available - increasing poll interval to {self.current_poll_interval} seconds")
                
            except KeyboardInterrupt:
                # Handled by signal handler
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
            
            # Sleep before next poll, but check for shutdown frequently
            if self.running:
                # Sleep in 1-second intervals to allow for responsive shutdown
                for _ in range(self.current_poll_interval):
                    if not self.running:
                        break
                    time.sleep(1)
        
        # Shutdown
        if self.current_job_id:
            logger.warning(f"Shutting down with job {self.current_job_id} still in progress")
        
        logger.info("Runner stopped")


def run_runner(api_key: str) -> None:
    """Run the job runner.
    
    Args:
        api_key: Runner API key
    """
    runner = JobRunner(api_key)
    runner.run()

"""API client for communicating with the Runpack worker."""

import logging
from typing import Any, Dict, List, Optional

import requests


logger = logging.getLogger(__name__)


class RunpackClient:
    """Client for interacting with the Runpack worker API."""

    def __init__(self, worker_url: str, api_key: str):
        """Initialize the API client.
        
        Args:
            worker_url: Base URL of the worker
            api_key: Runner API key for authentication
        """
        self.worker_url = worker_url.rstrip('/')
        self.api_key = api_key
        self.runner_id: Optional[str] = None

    def _headers(self) -> Dict[str, str]:
        """Get request headers including authentication.
        
        Returns:
            Dictionary of headers
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        if self.runner_id:
            headers['X-Runner-ID'] = self.runner_id
        return headers

    def register_runner(self, name: str, capabilities: List[str]) -> str:
        """Register this runner with the worker.
        
        Args:
            name: Runner name
            capabilities: List of job types this runner can handle
            
        Returns:
            Runner ID assigned by the worker
            
        Raises:
            Exception: If registration fails
        """
        url = f"{self.worker_url}/api/runner/register"
        data = {
            'name': name,
            'capabilities': capabilities
        }
        
        logger.info(f"Registering runner '{name}' with capabilities: {capabilities}")
        
        response = requests.post(url, json=data, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        runner_id = result['runner_id']
        self.runner_id = runner_id
        
        logger.info(f"Successfully registered with runner_id: {runner_id}")
        return runner_id

    def verify_runner(self) -> bool:
        """Verify that this runner is registered in the system.
        
        Returns:
            True if the runner exists in the system, False otherwise
            
        Raises:
            Exception: If verification request fails (network error, etc.)
        """
        if not self.runner_id:
            raise ValueError("Cannot verify runner: runner_id is not set")
        
        url = f"{self.worker_url}/api/runner/verify"
        
        logger.debug(f"Verifying runner ID: {self.runner_id}")
        
        try:
            response = requests.get(url, headers=self._headers())
            
            if response.status_code == 404:
                # Runner not found in system
                return False
            
            response.raise_for_status()
            result = response.json()
            
            exists = result.get('exists', False)
            if exists:
                logger.debug(f"Runner verified: {result.get('runner_name')}")
            else:
                logger.debug("Runner not found in system")
            
            return exists
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to verify runner: {e}")
            raise

    def get_available_jobs(self, job_types: List[str]) -> List[Dict[str, Any]]:
        """Get available jobs matching the specified types.
        
        Args:
            job_types: List of job types to query for
            
        Returns:
            List of available jobs
        """
        url = f"{self.worker_url}/api/runner/jobs/available"
        params = {'types[]': job_types}
        
        response = requests.get(url, params=params, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        return result.get('jobs', [])

    def claim_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Claim a job for execution.
        
        Args:
            job_id: ID of the job to claim
            
        Returns:
            Job details if successfully claimed, None otherwise
        """
        url = f"{self.worker_url}/api/runner/jobs/{job_id}/claim"
        
        logger.info(f"Claiming job {job_id}")
        
        response = requests.post(url, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        if result.get('success'):
            logger.info(f"Successfully claimed job {job_id}")
            return result.get('job')
        else:
            logger.warning(f"Failed to claim job {job_id}: {result.get('message')}")
            return None

    def send_heartbeat(
        self,
        job_id: str,
        progress_current: int,
        progress_total: int,
        console_output: str
    ) -> bool:
        """Send a heartbeat for a job in progress.
        
        Args:
            job_id: ID of the job
            progress_current: Current progress value
            progress_total: Total progress value
            console_output: Console output to append
            
        Returns:
            True if heartbeat was successful
        """
        url = f"{self.worker_url}/api/runner/jobs/{job_id}/heartbeat"
        data = {
            'progress_current': progress_current,
            'progress_total': progress_total,
            'console_output': console_output
        }
        
        response = requests.post(url, json=data, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        return result.get('success', False)

    def complete_job(
        self,
        job_id: str,
        output_data: Dict[str, Any],
        console_output: str
    ) -> bool:
        """Report successful job completion.
        
        Args:
            job_id: ID of the job
            output_data: Job result data
            console_output: Final console output
            
        Returns:
            True if completion was reported successfully
        """
        url = f"{self.worker_url}/api/runner/jobs/{job_id}/complete"
        data = {
            'output_data': output_data,
            'console_output': console_output
        }
        
        logger.info(f"Completing job {job_id}")
        
        response = requests.post(url, json=data, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        success = result.get('success', False)
        
        if success:
            logger.info(f"Successfully completed job {job_id}")
        else:
            logger.error(f"Failed to complete job {job_id}: {result.get('message')}")
        
        return success

    def error_job(
        self,
        job_id: str,
        error_message: str,
        console_output: str
    ) -> bool:
        """Report job failure.
        
        Args:
            job_id: ID of the job
            error_message: Error message
            console_output: Final console output
            
        Returns:
            True if error was reported successfully
        """
        url = f"{self.worker_url}/api/runner/jobs/{job_id}/error"
        data = {
            'error_message': error_message,
            'console_output': console_output
        }
        
        logger.info(f"Reporting error for job {job_id}: {error_message}")
        
        response = requests.post(url, json=data, headers=self._headers())
        response.raise_for_status()
        
        result = response.json()
        success = result.get('success', False)
        
        if success:
            logger.info(f"Successfully reported error for job {job_id}")
        else:
            logger.error(f"Failed to report error for job {job_id}: {result.get('message')}")
        
        return success

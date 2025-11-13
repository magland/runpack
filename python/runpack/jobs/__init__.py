"""Job handlers registry for the Runpack runner."""

from typing import Dict, Type
from .base import JobHandler
from .hello_world import HelloWorldJob
from .figpack_nwb_raster_plot import FigpackNwbRasterPlotJob
from .figpack_nwb_video_preview import FigpackNwbVideoPreviewJob


# Registry mapping job types to handler classes
JOB_HANDLERS: Dict[str, Type[JobHandler]] = {
    'hello_world': HelloWorldJob,
    'figpack_nwb_raster_plot': FigpackNwbRasterPlotJob,
    'figpack_nwb_video_preview': FigpackNwbVideoPreviewJob,
}


def get_job_handler(job_type: str) -> Type[JobHandler]:
    """Get the handler class for a job type.
    
    Args:
        job_type: The type of job
        
    Returns:
        Handler class for the job type
        
    Raises:
        ValueError: If job type is not supported
    """
    if job_type not in JOB_HANDLERS:
        raise ValueError(f"Unsupported job type: {job_type}")
    return JOB_HANDLERS[job_type]


def get_supported_job_types() -> list:
    """Get list of supported job types.
    
    Returns:
        List of job type names
    """
    return list(JOB_HANDLERS.keys())

"""Command-line interface for the Runpack runner."""

import logging
import os
import sys

import click

from .config import LOG_FILE
from .runner import run_runner


def setup_logging():
    """Configure logging to both file and console."""
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # File handler
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)


@click.group()
def main():
    """Runpack distributed job computation runner."""
    pass


@main.command()
def runner():
    """Start the job runner to poll and execute jobs."""
    # Setup logging
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # Check for API key
    api_key = os.environ.get('RUNPACK_RUNNER_API_KEY')
    if not api_key:
        logger.error("RUNPACK_RUNNER_API_KEY environment variable is not set")
        click.echo("Error: RUNPACK_RUNNER_API_KEY environment variable must be set", err=True)
        click.echo("\nPlease set your runner API key:", err=True)
        click.echo("  export RUNPACK_RUNNER_API_KEY=your_api_key_here", err=True)
        sys.exit(1)
    
    logger.info(f"Logging to: {LOG_FILE}")
    
    try:
        # Run the runner
        run_runner(api_key)
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

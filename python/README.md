# Runpack Python Runner

Python job runner for the Runpack distributed job computation and caching system.

## Overview

This package provides a job runner that:
- Polls the Runpack worker for available jobs
- Executes jobs using registered job handlers
- Reports progress via heartbeats
- Sends results or errors back to the worker
- Handles graceful shutdown

## Installation

### From Source

```bash
cd python
pip install -e .
```

### Requirements

- Python 3.8 or higher
- `click` >= 8.1.0
- `requests` >= 2.31.0

## Configuration

### Environment Variables

Set the runner API key before starting the runner:

```bash
export RUNPACK_RUNNER_API_KEY=your_runner_api_key_here
```

### Hard-coded Settings

The following are hard-coded in the package:

- **Worker URL**: `https://runpack-worker.neurosift.app`
- **Poll Interval**: Progressive backoff from 10 to 60 seconds
  - Starts at 10 seconds
  - Increases by 2 seconds after each empty poll
  - Resets to 10 seconds when a job is executed
  - Maximum interval of 60 seconds
- **Heartbeat Interval**: 30 seconds (during job execution)

### Configuration Files

The runner creates two files in the working directory:

- `.runpack_runner.json` - Stores runner ID and name (auto-generated)
- `runpack_runner.log` - Log file with timestamped entries

## Usage

### Starting the Runner

```bash
# Set your runner API key
export RUNPACK_RUNNER_API_KEY=your_runner_api_key_here

# Start the runner
runpack runner
```

The runner will:
1. Register with the worker (or load existing registration)
2. Start polling for jobs (starting at 10 seconds, progressively backing off to 60 seconds when idle)
3. Execute jobs as they become available
4. Log all activity to `runpack_runner.log`

### Stopping the Runner

Press `Ctrl+C` or send `SIGTERM` to gracefully shut down the runner. The runner will:
- Complete the current job if one is in progress
- Clean up and exit

## Supported Job Types

### hello_world

A test job that greets a user and simulates processing time.

**Input Parameters:**
- `name` (string, required): Name to greet
- `processing_time` (number, required): Seconds to simulate processing (0-300)

**Example Job Submission:**

```json
{
  "job_type": "hello_world",
  "input_params": {
    "name": "Alice",
    "processing_time": 60
  }
}
```

**Output:**

```json
{
  "message": "Hello, Alice!",
  "processing_time": 60
}
```

**Console Output:**

```
[2025-01-12 13:00:00] Starting hello_world job for Alice
[2025-01-12 13:00:00] Processing time: 60 seconds
[2025-01-12 13:00:30] Progress: 50%
[2025-01-12 13:01:00] Completed!
```

### figpack_nwb_raster_plot

Generates a raster plot visualization from NWB (Neurodata Without Borders) units table data and uploads it to figurl.

**Input Parameters:**
- `nwb_url` (string, required): HTTP/HTTPS URL to the NWB file
- `units_path` (string, required): Path to the units table within the NWB file (e.g., '/units')

**Example Job Submission:**

```json
{
  "job_type": "figpack_nwb_raster_plot",
  "input_params": {
    "nwb_url": "https://api.dandiarchive.org/api/assets/3919ebaa-d727-40b1-a8a0-ffac92ef81f1/download/",
    "units_path": "/units"
  }
}
```

**Output:**

```json
{
  "figpack_url": "https://...",
  "nwb_url": "https://api.dandiarchive.org/api/assets/3919ebaa-d727-40b1-a8a0-ffac92ef81f1/download/",
  "units_path": "/units"
}
```

**Console Output:**

```
[2025-01-12 13:00:00] Importing required libraries...
[2025-01-12 13:00:01] Starting heartbeat thread...
[2025-01-12 13:00:01] Loading NWB file from: https://api.dandiarchive.org/...
[2025-01-12 13:00:01] Units path: /units
[2025-01-12 13:00:01] This may take several minutes for large files...
[2025-01-12 13:02:15] Successfully created RasterPlot view
[2025-01-12 13:02:15] Uploading raster plot to figurl...
[2025-01-12 13:02:15] This may take several minutes depending on data size...
[2025-01-12 13:03:45] Successfully uploaded! URL: https://figurl.org/f?v=...
[2025-01-12 13:03:45] Completed!
[2025-01-12 13:03:45] Stopping heartbeat thread...
```

**Requirements:**

This job requires the following Python packages to be installed:
```bash
pip install figpack figpack-spike-sorting
```

**Notes:**
- This job uses a background thread to send heartbeats every 30 seconds during potentially long-running operations (loading NWB files and uploading to figurl)
- Processing time varies based on NWB file size and network speed
- The returned `figpack_url` can be used to view the interactive raster plot visualization

## Architecture

### Components

1. **CLI (`cli.py`)**: Command-line interface using Click
2. **Runner (`runner.py`)**: Main polling and execution loop
3. **Client (`client.py`)**: API client for worker communication
4. **Config (`config.py`)**: Configuration management
5. **Jobs (`jobs/`)**: Job handler implementations

### Job Handler Interface

To add a new job type, create a handler that extends `JobHandler`:

```python
from runpack.jobs import JobHandler

class MyCustomJob(JobHandler):
    def execute(self, input_params: dict, heartbeat_callback) -> dict:
        # Validate parameters
        if 'required_param' not in input_params:
            raise ValueError("Missing required parameter")
        
        # Do work
        result = do_something(input_params)
        
        # Send heartbeats during long operations
        heartbeat_callback(
            progress_current=50,
            progress_total=100,
            console_output="Processing..."
        )
        
        # Return result (console_output will be extracted automatically)
        return {
            'result': result,
            'console_output': 'Job completed successfully'
        }
```

Then register it in `jobs/__init__.py`:

```python
JOB_HANDLERS = {
    'hello_world': HelloWorldJob,
    'my_custom_job': MyCustomJob,
}
```

## Logging

All logs are written to both:
- **Console** (stdout): For real-time monitoring
- **File** (`runpack_runner.log`): For persistent records

Log format: `[YYYY-MM-DD HH:MM:SS] LEVEL: Message`

## Error Handling

### Parameter Validation

Jobs should validate input parameters and raise `ValueError` for invalid inputs. The runner will catch these and report them as job errors to the worker.

### Network Errors

Network errors during polling are logged and the runner continues. Network errors during job execution are retried.

### Graceful Shutdown

The runner handles `SIGINT` and `SIGTERM` signals gracefully:
- Stops accepting new jobs
- Completes current job if possible
- Logs shutdown information

## Development

### Running Tests

```bash
# Install in development mode
pip install -e .

# Run the runner
runpack runner
```

### Adding New Job Types

1. Create a new file in `runpack/jobs/`
2. Implement a class extending `JobHandler`
3. Register it in `runpack/jobs/__init__.py`
4. Test by submitting jobs via the worker API

## Troubleshooting

### "RUNPACK_RUNNER_API_KEY environment variable is not set"

Set the API key before running:
```bash
export RUNPACK_RUNNER_API_KEY=your_key_here
```

### "Failed to register runner"

- Verify the worker URL is correct and accessible
- Check that your API key is valid
- Ensure network connectivity to the worker

### "No jobs available"

This is normal - the runner uses progressive backoff polling (10-60 seconds) and will execute jobs when they're submitted.

### Runner stops unexpectedly

Check `runpack_runner.log` for error messages. Common issues:
- Network connectivity problems
- Invalid job parameters
- Job handler exceptions

## License

MIT License

## Support

For issues or questions, see the main Runpack repository.

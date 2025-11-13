# Runpack

A distributed job computation and caching system built with Cloudflare Workers, D1 database, and Python job runners.

## Overview

### Motivation: On-Demand Computation for Neurosift

Runpack was created to enable on-demand computation for [Neurosift](https://neurosift.app), a neurophysiology data visualization platform. The primary use case is to support advanced, interactive visualizations using [Figpack](https://flatironinstitute.github.io/figpack/) that require computational backend processing.

**The Challenge:** When visualizing neurophysiology data, for example neural units tables containing hundreds or thousands of neurons recorded over long durations, traditional visualization approaches become inefficient and impractical. Rendering a complete raster plot of all spike times for such datasets in a browser is computationally prohibitive.

**The Solution:** Figpack provides sophisticated visualization components that prepare efficient, hierarchical data representations. For raster plots, it creates a Zarr-based hierarchy of downsampled firing rates and time-segmented spike trains, enabling smooth, interactive visualization of large-scale neural activity. However, this preprocessing requires substantial backend computation.

**The Problem:** Pre-computing these visualizations for every possible units table across the entire [DANDI Archive](https://dandiarchive.org) would be wasteful and impractical, as most visualizations may never be viewed.

**How Runpack Solves This:** Runpack provides an on-demand computation service that acts as a bridge between Neurosift and computational resources:

1. When a user opens a dataset in Neurosift and requests an advanced visualization (e.g., a Figpack raster plot), the Neurosift interface submits a computation job to Runpack
2. A job runner—which can run on any computer with appropriate resources—picks up the job, performs the necessary computation, and uploads the resulting Figpack figure to cloud storage
3. The result is cached, so subsequent visitors can instantly access the same visualization without re-computation
4. This architecture allows resource-intensive computations to be performed on-demand only when needed, while still providing fast access to previously computed results

Basic example of a Figpack raster plot view in Neurosift: [FigpackRasterPlot](https://neurosift.app/nwb?url=https://api.dandiarchive.org/api/assets/6e7e9b91-0d66-45af-b646-dfb11e4d9967/download/&dandisetId=000946&dandisetVersion=draft&tab=view:FigpackRasterPlot|/units)

Compared with the inefficient default raster plot that requires no precomputation: [Raster](https://neurosift.app/nwb?url=https://api.dandiarchive.org/api/assets/6e7e9b91-0d66-45af-b646-dfb11e4d9967/download/&dandisetId=000946&dandisetVersion=draft&tab=view:Raster|/units)

### General Purpose System

Beyond its primary use case with Neurosift, Runpack is a flexible system for computing and caching diverse computational tasks. It provides:

- **Centralized Job Queue**: Submit jobs through a Cloudflare Worker API
- **Smart Caching**: Automatic deduplication and result caching based on job type and parameters
- **Distributed Execution**: Python job runners on various machines execute the actual computations
- **Result Validation**: Optional validation to ensure cached results are still valid (e.g., uploaded files still exist)
- **Real-time Monitoring**: Track job progress, runner status, and system statistics

## Architecture

```
┌─────────────┐
│   Clients   │ Submit jobs, query status
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│   Cloudflare Worker (API)   │
│                             │
│  • Job submission           │
│  • Result caching           │
│  • Runner coordination      │
│  • Admin endpoints          │
└──────────┬──────────────────┘
           │
           ├─────────────────┐
           │                 │
           ▼                 ▼
    ┌─────────────┐   ┌─────────────┐
    │ D1 Database │   │   Runners   │
    │             │   │  (Python)   │
    │ • Jobs      │   │             │
    │ • Runners   │   │ • Poll jobs │
    │ • Results   │   │ • Execute   │
    └─────────────┘   │ • Report    │
                      └─────────────┘
```

## Components

### 1. Cloudflare Worker (`worker/`)

The central API that manages:
- Job submission and deduplication
- Job queue management
- Runner coordination and monitoring
- Result caching and validation
- Authentication and rate limiting

**Technology**: TypeScript, Cloudflare Workers, D1 Database

[See worker/README.md for detailed documentation](worker/README.md)

### 2. Python Job Runners (`python/`) - *Coming Soon*

Distributed workers that:
- Register with the central worker
- Poll for available jobs matching their capabilities
- Execute computations
- Send heartbeats to indicate progress
- Report results or errors back to the worker

**Technology**: Python 3.x

### 3. Frontend Application

Web interface for:
- Dashboard with real-time statistics
- Jobs management and monitoring
- Runners information and tracking
- Job submission playground
- System configuration

**Technology**: React, TypeScript, Vite, Material-UI

[See frontend/README.md for detailed documentation](frontend/README.md)

## Key Features

### 🔄 Smart Deduplication

Jobs are uniquely identified by a hash of their type and input parameters. If the same job is submitted multiple times:
- First submission: Job is queued for execution
- Subsequent submissions: Cached result is returned immediately (if still valid)

### 📊 Progress Tracking

Runners send periodic heartbeats (at least once per 90 seconds) that include:
- Progress indicators (current/total)
- Console output updates
- Timestamp for timeout detection

### 🔐 Multi-Level Authentication

Three separate API keys for different access levels:
- **SUBMIT_API_KEY**: For job submission and status queries
- **RUNNER_API_KEY**: For job runner operations
- **ADMIN_API_KEY**: For administrative monitoring

### 🚦 Rate Limiting

Configurable rate limits prevent abuse:
- Job submission: 10 requests/minute per IP
- Status polling: 60 requests/minute per IP
- Runner heartbeats: 120 requests/minute per runner
- Admin endpoints: Effectively unlimited

### 💾 Result Caching

Completed job results are cached indefinitely. Optional validation can check if:
- Uploaded files still exist in cloud storage
- External resources are still accessible
- Results meet other validity criteria

If validation fails, the job is marked as "expired" and can be re-queued.

## Job Lifecycle

```
1. SUBMIT
   Client submits job (type + params)
   ↓
2. HASH & CHECK
   Worker computes hash, checks for existing job
   ↓
3. QUEUE (if new)
   Status: pending
   ↓
4. CLAIM
   Runner claims job
   Status: claimed → in_progress
   ↓
5. EXECUTE
   Runner executes, sends heartbeats
   ↓
6. COMPLETE
   Runner reports result or error
   Status: completed | failed
   ↓
7. CACHE
   Future identical jobs return cached result
```

## Job States

- **pending**: Job queued, waiting for runner
- **claimed**: Runner has claimed the job
- **in_progress**: Runner actively working on job
- **completed**: Job finished successfully, result cached
- **failed**: Job execution failed (error message stored)
- **expired**: Cached result no longer valid (validation failed)

## Use Cases

### Scientific Computing
- Run expensive simulations
- Process large datasets
- Generate visualizations
- Cache results for reproducibility

### Data Processing
- Transform and aggregate data
- Generate reports
- Process media files
- ETL pipelines

### Web Scraping
- Fetch and cache web content
- Monitor website changes
- Aggregate data from multiple sources

### Machine Learning
- Train models with specific parameters
- Generate predictions
- Cache model outputs
- A/B testing different configurations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for Workers and D1)
- Python 3.8+ (for job runners)
- Wrangler CLI: `npm install -g wrangler`

### Quick Start

1. **Set up the Cloudflare Worker:**
   ```bash
   cd worker
   npm install
   wrangler d1 create runpack-db
   # Update database_id in wrangler.toml
   npm run db:init
   wrangler secret put SUBMIT_API_KEY
   wrangler secret put RUNNER_API_KEY
   wrangler secret put ADMIN_API_KEY
   npm run deploy
   ```

2. **Create a Python job runner:**
   ```bash
   cd python
   pip install -e .
   # Set runner API key
   export RUNPACK_RUNNER_API_KEY=your_runner_api_key
   # Start the runner
   runpack runner
   ```

3. **Submit a job:**
   ```bash
   curl -X POST https://your-worker.workers.dev/api/jobs/submit \
     -H "Authorization: Bearer YOUR_SUBMIT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "job_type": "example_task",
       "input_params": {
         "input": "data"
       }
     }'
   ```

## Configuration

### Worker Configuration (`worker/src/config.ts`)

```typescript
// Rate limits (requests per minute)
JOB_SUBMISSION: 10
JOB_POLLING: 60
RUNNER_HEARTBEAT: 120

// Size limits
INPUT_PARAMS: 100 KB
OUTPUT_DATA: 500 KB
CONSOLE_OUTPUT: 1 MB

// Timeouts
HEARTBEAT_THRESHOLD: 90 seconds
RUNNER_ACTIVE_THRESHOLD: 5 minutes
```

## API Documentation

### Check Job Existence

```http
POST /api/jobs/check
Authorization: Bearer <SUBMIT_API_KEY>
Content-Type: application/json

{
  "job_type": "task_name",
  "input_params": { "key": "value" }
}
```

Check if a job exists without creating it. Returns `exists: false` if the job doesn't exist, or `exists: true` with job details if it does.

### Submit a Job

```http
POST /api/jobs/submit
Authorization: Bearer <SUBMIT_API_KEY>
Content-Type: application/json

{
  "job_type": "task_name",
  "input_params": { "key": "value" }
}
```

### Get Job Status

```http
GET /api/jobs/{jobId}
Authorization: Bearer <SUBMIT_API_KEY>
```

### Runner Registration

```http
POST /api/runner/register
Authorization: Bearer <RUNNER_API_KEY>
Content-Type: application/json

{
  "name": "runner-1",
  "capabilities": ["task_type_1", "task_type_2"]
}
```

For complete API documentation, see [worker/README.md](worker/README.md).

## Project Structure

```
runpack/
├── README.md                    # This file
├── describe.md                  # Original project description
├── worker/                      # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── router.ts           # Request routing
│   │   ├── config.ts           # Configuration
│   │   ├── types/              # TypeScript types
│   │   ├── db/                 # Database schema & queries
│   │   ├── handlers/           # Request handlers
│   │   ├── middleware/         # Auth & rate limiting
│   │   └── utils/              # Utilities
│   ├── wrangler.toml           # Cloudflare config
│   ├── package.json
│   └── README.md
├── python/                      # Python job runners (Coming Soon)
│   ├── runpack/
│   │   ├── __init__.py
│   │   ├── runner.py           # Job runner implementation
│   │   └── client.py           # API client
│   └── setup.py
└── frontend/                    # Web UI
    ├── src/
    │   ├── api/                # API client
    │   ├── components/         # React components
    │   ├── pages/              # Page components
    │   ├── hooks/              # Custom hooks
    │   ├── types/              # TypeScript types
    │   ├── utils/              # Utilities
    │   ├── App.tsx             # Main app
    │   └── main.tsx            # Entry point
    ├── public/
    ├── package.json
    └── README.md
```

## Development Roadmap

- [x] Cloudflare Worker implementation
- [x] Database schema and queries
- [x] API endpoints for jobs and runners
- [x] Authentication and rate limiting
- [x] Job deduplication and caching
- [x] Frontend web application
- [x] Monitoring dashboard
- [ ] Python job runner framework
- [ ] Example job types and handlers
- [ ] Job retry logic
- [ ] Advanced validation system
- [ ] Runner load balancing
- [ ] Job priorities and scheduling

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Security Considerations

- **API Keys**: Store API keys securely, never commit them to version control
- **Input Validation**: All inputs are validated for size and format
- **Rate Limiting**: Prevents abuse and ensures fair resource usage
- **Authentication**: All endpoints require valid API keys
- **CORS**: Configured for secure cross-origin requests

## License

MIT License - see individual component directories for details.

## Support

For questions or issues:
- Check the [worker/README.md](worker/README.md) for API documentation
- Open an issue on GitHub
- Review the job lifecycle documentation above

## Acknowledgments

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless compute platform
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQL database
- Python - Job runner implementation
- TypeScript - Worker implementation

# Runpack Worker

A Cloudflare Worker for managing distributed job computation and result caching.

## Overview

Runpack is a job queue and caching system that:
- Accepts job submissions with type and input parameters
- Caches completed job results (deduplication via hash)
- Manages distributed job runners that execute the actual computations
- Provides admin endpoints for monitoring

## Project Structure

```
worker/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── router.ts             # Request routing
│   ├── config.ts             # Configuration constants
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── db/
│   │   ├── schema.sql        # D1 database schema
│   │   └── queries.ts        # Database query functions
│   ├── handlers/
│   │   ├── jobs.ts           # Job submission & status handlers
│   │   ├── runner.ts         # Runner endpoint handlers
│   │   └── admin.ts          # Admin endpoint handlers
│   ├── middleware/
│   │   ├── auth.ts           # API key authentication
│   │   └── ratelimit.ts      # Rate limiting logic
│   └── utils/
│       ├── hash.ts           # Job hash generation
│       └── validation.ts     # Input validation
├── wrangler.toml             # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create runpack-db

# Copy the database_id from the output and update wrangler.toml
# Replace YOUR_DATABASE_ID with the actual ID
```

### 3. Initialize Database Schema

```bash
npm run db:init
```

### 4. Set API Keys

```bash
# Set the API keys as secrets
wrangler secret put SUBMIT_API_KEY
wrangler secret put RUNNER_API_KEY
wrangler secret put ADMIN_API_KEY
```

### 5. Deploy

```bash
# Deploy to production
npm run deploy

# Or run locally for development
npm run dev
```

## API Endpoints

### Job Submission (requires SUBMIT_API_KEY)

#### Check Job Existence
```
POST /api/jobs/check
Authorization: Bearer <SUBMIT_API_KEY>
Content-Type: application/json

{
  "job_type": "example_task",
  "input_params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

Response:
- If job does not exist: `200 OK` with `exists: false`
- If job exists and completed: `200 OK` with `exists: true`, job_id, status, and cached result
- If job exists and in progress: `200 OK` with `exists: true`, job_id, and current status
- If job exists and failed: `200 OK` with `exists: true`, job_id, status, and error message

This endpoint checks for job existence without creating it if it doesn't exist. Use this when you want to determine if a job has been submitted before without actually queuing a new job.

#### Submit a Job
```
POST /api/jobs/submit
Authorization: Bearer <SUBMIT_API_KEY>
Content-Type: application/json

{
  "job_type": "example_task",
  "input_params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

Response:
- If new job: `201 Created` with job_id and status "pending"
- If job exists and completed: `200 OK` with cached result
- If job exists and in progress: `200 OK` with current status

#### Get Job Status
```
GET /api/jobs/{jobId}
Authorization: Bearer <SUBMIT_API_KEY>
```

### Runner Operations (requires RUNNER_API_KEY)

#### Register a Runner
```
POST /api/runner/register
Authorization: Bearer <RUNNER_API_KEY>
Content-Type: application/json

{
  "name": "my-runner-1",
  "capabilities": ["task_type_1", "task_type_2"]
}
```

Returns a `runner_id` to use in subsequent requests.

#### Get Available Jobs
```
GET /api/runner/jobs/available?types[]=task_type_1&types[]=task_type_2
Authorization: Bearer <RUNNER_API_KEY>
X-Runner-ID: <runner_id>
```

#### Claim a Job
```
POST /api/runner/jobs/{jobId}/claim
Authorization: Bearer <RUNNER_API_KEY>
X-Runner-ID: <runner_id>
```

#### Send Heartbeat
```
POST /api/runner/jobs/{jobId}/heartbeat
Authorization: Bearer <RUNNER_API_KEY>
X-Runner-ID: <runner_id>
Content-Type: application/json

{
  "progress_current": 50,
  "progress_total": 100,
  "console_output": "Processing... 50%"
}
```

#### Complete Job
```
POST /api/runner/jobs/{jobId}/complete
Authorization: Bearer <RUNNER_API_KEY>
X-Runner-ID: <runner_id>
Content-Type: application/json

{
  "output_data": {
    "result": "success",
    "data": { ... }
  },
  "console_output": "Job completed successfully"
}
```

#### Report Job Error
```
POST /api/runner/jobs/{jobId}/error
Authorization: Bearer <RUNNER_API_KEY>
X-Runner-ID: <runner_id>
Content-Type: application/json

{
  "error_message": "Task failed due to...",
  "console_output": "Error details..."
}
```

### Admin Endpoints (requires ADMIN_API_KEY or RUNNER_API_KEY)

#### List All Jobs
```
GET /api/admin/jobs?status=pending&limit=50
Authorization: Bearer <ADMIN_API_KEY>
```

#### List All Runners
```
GET /api/admin/runners
Authorization: Bearer <ADMIN_API_KEY>
```

#### Get Statistics
```
GET /api/admin/stats
Authorization: Bearer <ADMIN_API_KEY>
```

## Configuration

Edit `src/config.ts` to adjust:

- **Rate Limits**: Requests per minute for different operations
- **Size Limits**: Maximum sizes for input params, output JSON, console output
- **Timeouts**: Heartbeat threshold, runner active threshold

## Job Lifecycle

1. **Submit**: Client submits job → Worker checks if already computed
2. **Queue**: If new, job is added to database with status "pending"
3. **Claim**: Runner polls for available jobs and claims one (status → "claimed")
4. **Execute**: Runner executes job and sends periodic heartbeats (status → "in_progress")
5. **Complete**: Runner reports success or failure (status → "completed" or "failed")
6. **Cache**: Subsequent submissions with same type+params return cached result

## Heartbeat Requirements

- Runners must send heartbeat at least once per 90 seconds (configurable)
- If heartbeat timeout exceeded, job is marked as failed
- Heartbeat includes progress updates and console output

## Development

### Local Development
```bash
npm run dev
```

This starts a local development server with hot reloading.

### Database Queries

To run queries against your D1 database:
```bash
wrangler d1 execute runpack-db --command "SELECT * FROM jobs LIMIT 10"
```

## Security

- All endpoints require API key authentication
- Separate keys for job submission, runner operations, and admin access
- Rate limiting prevents abuse
- Input validation on all requests

## Next Steps

This worker is ready to use! To complete the runpack system:

1. Create Python job runners (see `../python/` directory)
2. Build frontend web application for job submission and monitoring
3. Deploy runners on various machines
4. Start submitting and processing jobs!

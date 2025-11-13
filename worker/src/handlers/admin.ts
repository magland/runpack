import { Env, AdminJobsResponse, AdminRunnersResponse, AdminStatsResponse, AdminJobDetailResponse, AdminRunnerDetailResponse } from '../types';
import { getAllJobs, getAllRunners, getJobStats, getJobById, getRunnerById, getJobsByRunner, deleteJob, deleteJobs } from '../db/queries';
import { TIMEOUTS } from '../config';

/**
 * Handle get all jobs (admin)
 */
export async function handleGetJobs(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as any;
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    const jobs = await getAllJobs(env, status, limit);

    const response: AdminJobsResponse = {
      jobs: jobs.map(job => ({
        job_id: job.id,
        job_type: job.job_type,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        claimed_by: job.claimed_by,
      })),
      total: jobs.length,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle get all runners (admin)
 */
export async function handleGetRunners(request: Request, env: Env): Promise<Response> {
  try {
    const runners = await getAllRunners(env);
    const now = Date.now();

    const response: AdminRunnersResponse = {
      runners: runners.map(runner => ({
        runner_id: runner.id,
        name: runner.name,
        capabilities: JSON.parse(runner.capabilities),
        last_seen: runner.last_seen,
        is_active: (now - runner.last_seen) < TIMEOUTS.RUNNER_ACTIVE_THRESHOLD,
      })),
      total: runners.length,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get runners',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle get statistics (admin)
 */
export async function handleGetStats(request: Request, env: Env): Promise<Response> {
  try {
    const jobStats = await getJobStats(env);
    const runners = await getAllRunners(env);
    const now = Date.now();

    const activeRunners = runners.filter(
      runner => (now - runner.last_seen) < TIMEOUTS.RUNNER_ACTIVE_THRESHOLD
    ).length;

    const totalJobs = Object.values(jobStats).reduce((sum, count) => sum + count, 0);

    const response: AdminStatsResponse = {
      jobs: {
        ...jobStats,
        total: totalJobs,
      },
      runners: {
        total: runners.length,
        active: activeRunners,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle get single job details (admin)
 */
export async function handleGetJobDetail(request: Request, env: Env, jobId: string): Promise<Response> {
  try {
    const job = await getJobById(env, jobId);

    if (!job) {
      return new Response(JSON.stringify({
        error: 'Job not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: AdminJobDetailResponse = {
      job_id: job.id,
      job_type: job.job_type,
      status: job.status,
      input_params: JSON.parse(job.input_params),
      created_at: job.created_at,
      updated_at: job.updated_at,
      claimed_by: job.claimed_by,
      claimed_at: job.claimed_at,
      console_output: job.console_output || '',
      last_heartbeat: job.last_heartbeat,
    };

    if (job.progress_current !== null && job.progress_total !== null) {
      response.progress = {
        current: job.progress_current,
        total: job.progress_total,
      };
    }

    if (job.output_data) {
      response.output_data = JSON.parse(job.output_data);
    }

    if (job.error_message) {
      response.error_message = job.error_message;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get job details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle get single runner details (admin)
 */
export async function handleGetRunnerDetail(request: Request, env: Env, runnerId: string): Promise<Response> {
  try {
    const runner = await getRunnerById(env, runnerId);

    if (!runner) {
      return new Response(JSON.stringify({
        error: 'Runner not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jobs = await getJobsByRunner(env, runnerId);
    const now = Date.now();

    const response: AdminRunnerDetailResponse = {
      runner_id: runner.id,
      name: runner.name,
      capabilities: JSON.parse(runner.capabilities),
      registered_at: runner.registered_at,
      last_seen: runner.last_seen,
      is_active: (now - runner.last_seen) < TIMEOUTS.RUNNER_ACTIVE_THRESHOLD,
      jobs: jobs.map(job => ({
        job_id: job.id,
        job_type: job.job_type,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
      })),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get runner details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle delete single job (admin)
 */
export async function handleDeleteJob(request: Request, env: Env, jobId: string): Promise<Response> {
  try {
    const result = await deleteJob(env, jobId);

    if (!result.success) {
      return new Response(JSON.stringify({
        error: result.error || 'Failed to delete job'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Job deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle batch delete jobs (admin)
 */
export async function handleBatchDeleteJobs(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { job_ids: string[] };
    
    if (!body.job_ids || !Array.isArray(body.job_ids)) {
      return new Response(JSON.stringify({
        error: 'Invalid request body. Expected { job_ids: string[] }'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.job_ids.length === 0) {
      return new Response(JSON.stringify({
        error: 'No job IDs provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await deleteJobs(env, body.job_ids);

    return new Response(JSON.stringify({
      success: result.success,
      deleted: result.deleted,
      failed: result.failed,
      message: `Deleted ${result.deleted} of ${body.job_ids.length} jobs`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

import {
  claimJob,
  completeJob,
  failJob,
  getAvailableJobs,
  getJobById,
  getRunnerById,
  registerRunner,
  updateJobHeartbeat,
  updateRunnerLastSeen,
} from '../db/queries';
import {
  AvailableJob,
  ClaimJobResponse,
  CompleteJobRequest,
  CompleteJobResponse,
  Env,
  ErrorJobRequest,
  ErrorJobResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  RegisterRunnerRequest,
  RegisterRunnerResponse
} from '../types';
import { generateId } from '../utils/hash';
import { validateConsoleOutput, validateErrorMessage, validateJobOutput } from '../utils/validation';

/**
 * Handle runner verification
 */
export async function handleVerifyRunner(request: Request, env: Env, runnerId: string): Promise<Response> {
  try {
    // Check if runner exists in database
    const runner = await getRunnerById(env, runnerId);

    if (!runner) {
      return new Response(JSON.stringify({
        exists: false,
        message: 'Runner not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      exists: true,
      runner_name: runner.name,
      message: 'Runner verified successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to verify runner',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle runner registration
 */
export async function handleRegisterRunner(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as RegisterRunnerRequest;
    const { name, capabilities } = body;

    if (!name || !capabilities || !Array.isArray(capabilities)) {
      return new Response(JSON.stringify({ error: 'Invalid registration data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate runner ID
    const runnerId = generateId();

    // Register runner in database
    await registerRunner(env, runnerId, name, JSON.stringify(capabilities));

    const response: RegisterRunnerResponse = {
      runner_id: runnerId,
      message: 'Runner registered successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to register runner',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle get available jobs
 */
export async function handleGetAvailableJobs(request: Request, env: Env, runnerId: string): Promise<Response> {
  try {
    // Update runner last seen
    await updateRunnerLastSeen(env, runnerId);

    // Parse query parameters
    const url = new URL(request.url);
    const types = url.searchParams.getAll('types[]');

    if (types.length === 0) {
      return new Response(JSON.stringify({ jobs: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get available jobs
    const jobs = await getAvailableJobs(env, types);

    const availableJobs: AvailableJob[] = jobs.map(job => ({
      job_id: job.id,
      job_type: job.job_type,
      input_params: JSON.parse(job.input_params),
      created_at: job.created_at,
    }));

    return new Response(JSON.stringify({ jobs: availableJobs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get available jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle claim job
 */
export async function handleClaimJob(request: Request, env: Env, jobId: string, runnerId: string): Promise<Response> {
  try {
    // Update runner last seen
    await updateRunnerLastSeen(env, runnerId);

    // Try to claim the job
    const result = await claimJob(env, jobId, runnerId);

    if (!result.success) {
      const response: ClaimJobResponse = {
        success: false,
        message: result.error || 'Failed to claim job',
      };
      return new Response(JSON.stringify(response), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get job details
    const job = await getJobById(env, jobId);
    if (!job) {
      const response: ClaimJobResponse = {
        success: false,
        message: 'Job not found',
      };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: ClaimJobResponse = {
      success: true,
      message: 'Job claimed successfully',
      job: {
        job_id: job.id,
        job_type: job.job_type,
        input_params: JSON.parse(job.input_params),
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in handleClaimJob:', error);
    return new Response(JSON.stringify({
      error: 'Failed to claim job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle heartbeat
 */
export async function handleHeartbeat(request: Request, env: Env, jobId: string, runnerId: string): Promise<Response> {
  try {
    const body = await request.json() as HeartbeatRequest;
    const { progress_current, progress_total, console_output } = body;

    // Validate console output size
    const validation = validateConsoleOutput(console_output);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update runner last seen
    await updateRunnerLastSeen(env, runnerId);

    // Update job heartbeat
    const result = await updateJobHeartbeat(env, jobId, runnerId, progress_current, progress_total, console_output);

    if (!result.success) {
      const response: HeartbeatResponse = {
        success: false,
        message: result.error || 'Failed to update heartbeat',
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: HeartbeatResponse = {
      success: true,
      message: 'Heartbeat updated successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to update heartbeat',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle complete job
 */
export async function handleCompleteJob(request: Request, env: Env, jobId: string, runnerId: string): Promise<Response> {
  try {
    const body = await request.json() as CompleteJobRequest;
    const { output_data, console_output } = body;

    // Validate output
    const outputValidation = validateJobOutput(output_data);
    if (!outputValidation.valid) {
      return new Response(JSON.stringify({ error: outputValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const consoleValidation = validateConsoleOutput(console_output);
    if (!consoleValidation.valid) {
      return new Response(JSON.stringify({ error: consoleValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update runner last seen
    await updateRunnerLastSeen(env, runnerId);

    // Complete the job
    const result = await completeJob(env, jobId, runnerId, JSON.stringify(output_data), console_output);

    if (!result.success) {
      const response: CompleteJobResponse = {
        success: false,
        message: result.error || 'Failed to complete job',
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: CompleteJobResponse = {
      success: true,
      message: 'Job completed successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to complete job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle error job
 */
export async function handleErrorJob(request: Request, env: Env, jobId: string, runnerId: string): Promise<Response> {
  try {
    const body = await request.json() as ErrorJobRequest;
    const { error_message, console_output } = body;

    // Validate error message and console output
    const errorValidation = validateErrorMessage(error_message);
    if (!errorValidation.valid) {
      return new Response(JSON.stringify({ error: errorValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const consoleValidation = validateConsoleOutput(console_output);
    if (!consoleValidation.valid) {
      return new Response(JSON.stringify({ error: consoleValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update runner last seen
    await updateRunnerLastSeen(env, runnerId);

    // Fail the job
    const result = await failJob(env, jobId, runnerId, error_message, console_output);

    if (!result.success) {
      const response: ErrorJobResponse = {
        success: false,
        message: result.error || 'Failed to mark job as failed',
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: ErrorJobResponse = {
      success: true,
      message: 'Job marked as failed successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to mark job as failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

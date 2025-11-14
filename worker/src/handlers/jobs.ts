import { Env, SubmitJobRequest, SubmitJobResponse, JobStatusResponse, CheckJobRequest, CheckJobResponse } from '../types';
import { generateJobHash, generateId } from '../utils/hash';
import { validateJobInput } from '../utils/validation';
import { getJobByHash, getJobById, createJob, deleteJob } from '../db/queries';
import { validateJobResult } from '../utils/validation';

/**
 * Handle job submission
 */
export async function handleSubmitJob(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as SubmitJobRequest;
    const { job_type, input_params } = body;

    // Validate input
    const validation = validateJobInput(job_type, input_params);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate job hash
    const jobHash = await generateJobHash(job_type, input_params);

    // Check if job already exists
    const existingJob = await getJobByHash(env, jobHash);

    if (existingJob) {
      // Job exists - check its status
      if (existingJob.status === 'completed') {
        // Validate if result is still valid
        const isValid = await validateJobResult(existingJob);
        
        if (isValid) {
          // Return cached result
          const response: SubmitJobResponse = {
            job_id: existingJob.id,
            status: 'completed',
            message: 'Job already completed (cached result)',
            result: {
              output_data: JSON.parse(existingJob.output_data || '{}'),
              console_output: existingJob.console_output,
            },
          };
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // Result invalid - delete the job
          const {success: deleteSuccess, error: deleteError} = await deleteJob(env, existingJob.id);
          if (!deleteSuccess) {
            console.error('Failed to delete invalid job:', deleteError);
          }

          const response: SubmitJobResponse = {
            job_id: existingJob.id,
            status: 'expired',
            message: 'Job result has expired',
          };
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else if (existingJob.status === 'failed') {
        // Return failed status
        const response: SubmitJobResponse = {
          job_id: existingJob.id,
          status: 'failed',
          message: 'Job previously failed',
          error: existingJob.error_message || 'Unknown error',
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Job is pending, claimed, or in progress
        const response: SubmitJobResponse = {
          job_id: existingJob.id,
          status: existingJob.status,
          message: `Job is ${existingJob.status}`,
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Create new job
    const jobId = generateId();
    await createJob(env, jobId, jobHash, job_type, JSON.stringify(input_params));

    await reportNewJobToNotifyRelay(env, {
      jobId: jobId,
      jobHash: jobHash,
      jobType: job_type
    });

    const response: SubmitJobResponse = {
      job_id: jobId,
      status: 'pending',
      message: 'Job queued successfully',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to submit job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle job check (check existence without creating)
 */
export async function handleCheckJob(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as CheckJobRequest;
    const { job_type, input_params } = body;

    // Validate input
    const validation = validateJobInput(job_type, input_params);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate job hash
    const jobHash = await generateJobHash(job_type, input_params);

    // Check if job exists
    const existingJob = await getJobByHash(env, jobHash);

    if (!existingJob) {
      // Job does not exist
      const response: CheckJobResponse = {
        exists: false,
        message: 'Job does not exist',
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Job exists - return its status
    if (existingJob.status === 'completed') {
      // Validate if result is still valid
      console.log('Validating job result for existing completed job:', existingJob);
      const isValid = await validateJobResult(existingJob);
      
      if (isValid) {
        // Return cached result
        const response: CheckJobResponse = {
          exists: true,
          job_id: existingJob.id,
          status: 'completed',
          message: 'Job exists with cached result',
          result: {
            output_data: JSON.parse(existingJob.output_data || '{}'),
            console_output: existingJob.console_output,
          },
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Result expired
        const {
          success: deleteSuccess, 
          error: deleteError
        } = await deleteJob(env, existingJob.id);
        if (!deleteSuccess) {
          console.error('Failed to delete expired job:', deleteError);
        }

        const response: CheckJobResponse = {
          exists: true,
          job_id: existingJob.id,
          status: 'expired',
          message: 'Job exists but result has expired',
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (existingJob.status === 'failed') {
      // Return failed status
      const response: CheckJobResponse = {
        exists: true,
        job_id: existingJob.id,
        status: 'failed',
        message: 'Job exists but previously failed',
        error: existingJob.error_message || 'Unknown error',
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Job is pending, claimed, or in progress
      const response: CheckJobResponse = {
        exists: true,
        job_id: existingJob.id,
        status: existingJob.status,
        message: `Job exists and is ${existingJob.status}`,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to check job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle job status query
 */
export async function handleGetJobStatus(request: Request, env: Env, jobId: string): Promise<Response> {
  try {
    const job = await getJobById(env, jobId);

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: JobStatusResponse = {
      job_id: job.id,
      status: job.status,
      job_type: job.job_type,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };

    // Add progress if available
    if (job.progress_current !== null && job.progress_total !== null) {
      response.progress = {
        current: job.progress_current,
        total: job.progress_total,
      };
    }

    // Add result if completed
    if (job.status === 'completed' && job.output_data) {
      response.result = {
        output_data: JSON.parse(job.output_data),
        console_output: job.console_output,
      };
    }

    // Add error if failed
    if (job.status === 'failed' && job.error_message) {
      response.error = job.error_message;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

const reportNewJobToNotifyRelay = async (env: Env, jobInfo: {jobId: string, jobHash: string, jobType: string}) => {
  const NOTIFY_RELAY_BASE_URL = env.NOTIFY_RELAY_BASE_URL;
  const NOTIFY_RELAY_PUBLISH_KEY = env.NOTIFY_RELAY_PUBLISH_KEY;

  if (!NOTIFY_RELAY_BASE_URL || !NOTIFY_RELAY_PUBLISH_KEY) {
    console.warn('NotifyRelay configuration missing. Skipping new job notification.');
    return;
  }

  try {
    const response = await fetch(`${NOTIFY_RELAY_BASE_URL}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': NOTIFY_RELAY_PUBLISH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'runpack_notifications',
        message: {
          type: 'new_job',
          job_id: jobInfo.jobId,
          job_hash: jobInfo.jobHash,
          job_type: jobInfo.jobType,
          timestamp: Date.now(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish job notification: ${response.statusText}`);
    }

    console.log('Successfully published new job notification to NotifyRelay');
  } catch (error) {
    console.error('Error publishing job notification to NotifyRelay:', error);
  }
};
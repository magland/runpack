import { Env } from './types';
import { verifyAuth, getRunnerIdFromHeaders } from './middleware/auth';
import { checkRateLimit, getRateLimitKeyForIP, getRateLimitKeyForRunner } from './middleware/ratelimit';
import { RATE_LIMITS } from './config';
import { handleSubmitJob, handleGetJobStatus, handleCheckJob } from './handlers/jobs';
import {
  handleRegisterRunner,
  handleVerifyRunner,
  handleGetAvailableJobs,
  handleClaimJob,
  handleHeartbeat,
  handleCompleteJob,
  handleErrorJob,
} from './handlers/runner';
import { handleGetJobs, handleGetRunners, handleGetStats, handleGetJobDetail, handleGetRunnerDetail, handleDeleteJob, handleBatchDeleteJobs } from './handlers/admin';

/**
 * Route incoming requests to appropriate handlers
 */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Health check endpoint
  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'runpack-worker' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CORS headers for all API requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Runner-ID',
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Job check endpoint (check existence without creating)
    if (path === '/api/jobs/check' && method === 'POST') {
      const auth = verifyAuth(request, env, 'submit');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rateLimitKey = getRateLimitKeyForIP(request, 'submit');
      const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.JOB_SUBMISSION);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleCheckJob(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Job submission endpoints
    if (path === '/api/jobs/submit' && method === 'POST') {
      const auth = verifyAuth(request, env, 'submit');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rateLimitKey = getRateLimitKeyForIP(request, 'submit');
      const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.JOB_SUBMISSION);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleSubmitJob(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Job status endpoint
    const jobStatusMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobStatusMatch && method === 'GET') {
      const auth = verifyAuth(request, env, 'submit');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rateLimitKey = getRateLimitKeyForIP(request, 'poll');
      const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.JOB_POLLING);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = jobStatusMatch[1];
      const response = await handleGetJobStatus(request, env, jobId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Runner registration
    if (path === '/api/runner/register' && method === 'POST') {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleRegisterRunner(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Runner verification
    if (path === '/api/runner/verify' && method === 'GET') {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const runnerIdForVerify = getRunnerIdFromHeaders(request);
      if (!runnerIdForVerify) {
        return new Response(JSON.stringify({ error: 'Missing X-Runner-ID header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleVerifyRunner(request, env, runnerIdForVerify);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Runner endpoints - require runner ID in header
    const runnerId = getRunnerIdFromHeaders(request);
    if (!runnerId && path.startsWith('/api/runner/jobs')) {
      return new Response(JSON.stringify({ error: 'Missing X-Runner-ID header' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get available jobs
    if (path === '/api/runner/jobs/available' && method === 'GET' && runnerId) {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rateLimitKey = getRateLimitKeyForRunner(runnerId, 'available');
      const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.RUNNER_HEARTBEAT);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleGetAvailableJobs(request, env, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Claim job
    const claimMatch = path.match(/^\/api\/runner\/jobs\/([^/]+)\/claim$/);
    if (claimMatch && method === 'POST' && runnerId) {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = claimMatch[1];
      const response = await handleClaimJob(request, env, jobId, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Heartbeat
    const heartbeatMatch = path.match(/^\/api\/runner\/jobs\/([^/]+)\/heartbeat$/);
    if (heartbeatMatch && method === 'POST' && runnerId) {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rateLimitKey = getRateLimitKeyForRunner(runnerId, 'heartbeat');
      const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.RUNNER_HEARTBEAT);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = heartbeatMatch[1];
      const response = await handleHeartbeat(request, env, jobId, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Complete job
    const completeMatch = path.match(/^\/api\/runner\/jobs\/([^/]+)\/complete$/);
    if (completeMatch && method === 'POST' && runnerId) {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = completeMatch[1];
      const response = await handleCompleteJob(request, env, jobId, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Error job
    const errorMatch = path.match(/^\/api\/runner\/jobs\/([^/]+)\/error$/);
    if (errorMatch && method === 'POST' && runnerId) {
      const auth = verifyAuth(request, env, 'runner');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = errorMatch[1];
      const response = await handleErrorJob(request, env, jobId, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Admin endpoints
    if (path === '/api/admin/jobs' && method === 'GET') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleGetJobs(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (path === '/api/admin/runners' && method === 'GET') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleGetRunners(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (path === '/api/admin/stats' && method === 'GET') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleGetStats(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Admin job detail endpoint
    const adminJobMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)$/);
    if (adminJobMatch && method === 'GET') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = adminJobMatch[1];
      const response = await handleGetJobDetail(request, env, jobId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Admin runner detail endpoint
    const adminRunnerMatch = path.match(/^\/api\/admin\/runners\/([^/]+)$/);
    if (adminRunnerMatch && method === 'GET') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const runnerId = adminRunnerMatch[1];
      const response = await handleGetRunnerDetail(request, env, runnerId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Admin delete job endpoint
    const adminDeleteJobMatch = path.match(/^\/api\/admin\/jobs\/([^/]+)$/);
    if (adminDeleteJobMatch && method === 'DELETE') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const jobId = adminDeleteJobMatch[1];
      const response = await handleDeleteJob(request, env, jobId);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Admin batch delete jobs endpoint
    if (path === '/api/admin/jobs/batch-delete' && method === 'POST') {
      const auth = verifyAuth(request, env, 'admin');
      if (!auth.authorized) {
        return new Response(JSON.stringify(auth.error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await handleBatchDeleteJobs(request, env);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

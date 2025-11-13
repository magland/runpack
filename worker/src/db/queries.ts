import { Env, Job, Runner, JobStatus } from '../types';
import { TIMEOUTS } from '../config';

/**
 * Get a job by ID
 */
export async function getJobById(env: Env, jobId: string): Promise<Job | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM jobs WHERE id = ?'
  ).bind(jobId).first<Job>();

  return result;
}

/**
 * Get a job by hash
 */
export async function getJobByHash(env: Env, jobHash: string): Promise<Job | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM jobs WHERE job_hash = ?'
  ).bind(jobHash).first<Job>();

  return result;
}

/**
 * Create a new job
 */
export async function createJob(
  env: Env,
  id: string,
  jobHash: string,
  jobType: string,
  inputParams: string
): Promise<void> {
  const now = Date.now();
  
  await env.DB.prepare(
    `INSERT INTO jobs (id, job_hash, job_type, input_params, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(id, jobHash, jobType, inputParams, now, now).run();
}

/**
 * Get available jobs for a runner based on capabilities
 */
export async function getAvailableJobs(env: Env, jobTypes: string[]): Promise<Job[]> {
  if (jobTypes.length === 0) {
    return [];
  }

  // Build query with placeholders for job types
  const placeholders = jobTypes.map(() => '?').join(',');
  const query = `
    SELECT * FROM jobs 
    WHERE status = 'pending' 
    AND job_type IN (${placeholders})
    ORDER BY created_at ASC
    LIMIT 50
  `;

  const result = await env.DB.prepare(query).bind(...jobTypes).all<Job>();
  return result.results || [];
}

/**
 * Claim a job for a runner
 */
export async function claimJob(
  env: Env,
  jobId: string,
  runnerId: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  // Try to claim the job atomically
  // Only update if status is 'pending'
  const result = await env.DB.prepare(
    `UPDATE jobs 
     SET status = 'claimed', 
         claimed_by = ?, 
         claimed_at = ?, 
         last_heartbeat = ?,
         updated_at = ?
     WHERE id = ? AND status = 'pending'`
  ).bind(runnerId, now, now, now, jobId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Job already claimed or not found' };
  }

  return { success: true };
}

/**
 * Update job heartbeat and progress
 */
export async function updateJobHeartbeat(
  env: Env,
  jobId: string,
  runnerId: string,
  progressCurrent: number,
  progressTotal: number,
  consoleOutput: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  // Update heartbeat only if job is claimed/in_progress by this runner
  const result = await env.DB.prepare(
    `UPDATE jobs 
     SET status = 'in_progress',
         progress_current = ?,
         progress_total = ?,
         console_output = ?,
         last_heartbeat = ?,
         updated_at = ?
     WHERE id = ? AND claimed_by = ? AND status IN ('claimed', 'in_progress')`
  ).bind(progressCurrent, progressTotal, consoleOutput, now, now, jobId, runnerId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Job not found or not claimed by this runner' };
  }

  return { success: true };
}

/**
 * Complete a job
 */
export async function completeJob(
  env: Env,
  jobId: string,
  runnerId: string,
  outputDataJson: string,
  consoleOutput: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  const result = await env.DB.prepare(
    `UPDATE jobs 
     SET status = 'completed',
         output_data = ?,
         console_output = ?,
         updated_at = ?
     WHERE id = ? AND claimed_by = ? AND status IN ('claimed', 'in_progress')`
  ).bind(outputDataJson, consoleOutput, now, jobId, runnerId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Job not found or not claimed by this runner' };
  }

  return { success: true };
}

/**
 * Fail a job
 */
export async function failJob(
  env: Env,
  jobId: string,
  runnerId: string,
  errorMessage: string,
  consoleOutput: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  const result = await env.DB.prepare(
    `UPDATE jobs 
     SET status = 'failed',
         error_message = ?,
         console_output = ?,
         updated_at = ?
     WHERE id = ? AND claimed_by = ? AND status IN ('claimed', 'in_progress')`
  ).bind(errorMessage, consoleOutput, now, jobId, runnerId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Job not found or not claimed by this runner' };
  }

  return { success: true };
}

/**
 * Mark job as expired (validation failed)
 */
export async function markJobExpired(env: Env, jobId: string): Promise<void> {
  const now = Date.now();
  
  await env.DB.prepare(
    `UPDATE jobs SET status = 'expired', updated_at = ? WHERE id = ?`
  ).bind(now, jobId).run();
}

/**
 * Check and fail jobs with stale heartbeats
 */
export async function checkStaleJobs(env: Env): Promise<void> {
  const now = Date.now();
  const threshold = now - TIMEOUTS.HEARTBEAT_THRESHOLD;

  await env.DB.prepare(
    `UPDATE jobs 
     SET status = 'failed',
         error_message = 'Job timed out - no heartbeat received',
         updated_at = ?
     WHERE status IN ('claimed', 'in_progress') 
     AND last_heartbeat < ?`
  ).bind(now, threshold).run();
}

/**
 * Register a new runner
 */
export async function registerRunner(
  env: Env,
  id: string,
  name: string,
  capabilities: string
): Promise<void> {
  const now = Date.now();

  // Upsert: insert or update if already exists
  await env.DB.prepare(
    `INSERT INTO runners (id, name, capabilities, registered_at, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       capabilities = excluded.capabilities,
       last_seen = excluded.last_seen`
  ).bind(id, name, capabilities, now, now).run();
}

/**
 * Update runner last seen timestamp
 */
export async function updateRunnerLastSeen(env: Env, runnerId: string): Promise<void> {
  const now = Date.now();
  
  await env.DB.prepare(
    'UPDATE runners SET last_seen = ? WHERE id = ?'
  ).bind(now, runnerId).run();
}

/**
 * Get runner by ID
 */
export async function getRunnerById(env: Env, runnerId: string): Promise<Runner | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM runners WHERE id = ?'
  ).bind(runnerId).first<Runner>();

  return result;
}

/**
 * Get all runners
 */
export async function getAllRunners(env: Env): Promise<Runner[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM runners ORDER BY last_seen DESC'
  ).all<Runner>();

  return result.results || [];
}

/**
 * Get all jobs with optional filters
 */
export async function getAllJobs(
  env: Env,
  status?: JobStatus,
  limit: number = 100
): Promise<Job[]> {
  let query = 'SELECT * FROM jobs';
  const params: any[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all<Job>();
  return result.results || [];
}

/**
 * Get job statistics
 */
export async function getJobStats(env: Env): Promise<Record<JobStatus, number>> {
  const result = await env.DB.prepare(
    'SELECT status, COUNT(*) as count FROM jobs GROUP BY status'
  ).all<{ status: JobStatus; count: number }>();

  const stats: Record<JobStatus, number> = {
    pending: 0,
    claimed: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    expired: 0,
  };

  for (const row of result.results || []) {
    stats[row.status] = row.count;
  }

  return stats;
}

/**
 * Get jobs by runner ID
 */
export async function getJobsByRunner(env: Env, runnerId: string): Promise<Job[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM jobs WHERE claimed_by = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(runnerId).all<Job>();

  return result.results || [];
}

/**
 * Delete a single job by ID
 */
export async function deleteJob(env: Env, jobId: string): Promise<{ success: boolean; error?: string }> {
  const result = await env.DB.prepare(
    'DELETE FROM jobs WHERE id = ?'
  ).bind(jobId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Job not found' };
  }

  return { success: true };
}

/**
 * Delete multiple jobs by IDs
 */
export async function deleteJobs(env: Env, jobIds: string[]): Promise<{ 
  success: boolean; 
  deleted: number;
  failed: string[];
}> {
  if (jobIds.length === 0) {
    return { success: false, deleted: 0, failed: [] };
  }

  let deleted = 0;
  const failed: string[] = [];

  // Delete jobs one by one to track which ones succeed/fail
  for (const jobId of jobIds) {
    const result = await deleteJob(env, jobId);
    if (result.success) {
      deleted++;
    } else {
      failed.push(jobId);
    }
  }

  return {
    success: deleted > 0,
    deleted,
    failed,
  };
}

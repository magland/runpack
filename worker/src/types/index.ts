// Environment bindings
export interface Env {
  DB: D1Database;
  SUBMIT_API_KEY: string;
  RUNNER_API_KEY: string;
  ADMIN_API_KEY: string;
}

// Job statuses
export type JobStatus = 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed' | 'expired';

// Database models
export interface Job {
  id: string;
  job_hash: string;
  job_type: string;
  input_params: string; // JSON string
  status: JobStatus;
  created_at: number;
  updated_at: number;
  claimed_by: string | null;
  claimed_at: number | null;
  progress_current: number | null;
  progress_total: number | null;
  console_output: string;
  output_data: string | null; // JSON string
  error_message: string | null;
  last_heartbeat: number | null;
}

export interface Runner {
  id: string;
  name: string;
  capabilities: string; // JSON array of job types
  registered_at: number;
  last_seen: number;
}

// API request/response types
export interface SubmitJobRequest {
  job_type: string;
  input_params: Record<string, any>;
}

export interface SubmitJobResponse {
  job_id: string;
  status: JobStatus;
  message: string;
  result?: {
    output_data: any;
    console_output: string;
  };
  error?: string;
}

export interface CheckJobRequest {
  job_type: string;
  input_params: Record<string, any>;
}

export interface CheckJobResponse {
  exists: boolean;
  job_id?: string;
  status?: JobStatus;
  message: string;
  result?: {
    output_data: any;
    console_output: string;
  };
  error?: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  job_type: string;
  created_at: number;
  updated_at: number;
  progress?: {
    current: number;
    total: number;
  };
  result?: {
    output_data: any;
    console_output: string;
  };
  error?: string;
}

export interface RegisterRunnerRequest {
  name: string;
  capabilities: string[]; // Job types this runner can handle
}

export interface RegisterRunnerResponse {
  runner_id: string;
  message: string;
}

export interface AvailableJobsRequest {
  types: string[]; // Job types the runner can handle
}

export interface AvailableJob {
  job_id: string;
  job_type: string;
  input_params: any;
  created_at: number;
}

export interface ClaimJobResponse {
  success: boolean;
  message: string;
  job?: {
    job_id: string;
    job_type: string;
    input_params: any;
  };
}

export interface HeartbeatRequest {
  progress_current: number;
  progress_total: number;
  console_output: string;
}

export interface HeartbeatResponse {
  success: boolean;
  message: string;
}

export interface CompleteJobRequest {
  output_data: Record<string, any>;
  console_output: string;
}

export interface CompleteJobResponse {
  success: boolean;
  message: string;
}

export interface ErrorJobRequest {
  error_message: string;
  console_output: string;
}

export interface ErrorJobResponse {
  success: boolean;
  message: string;
}

// Admin types
export interface AdminJobsResponse {
  jobs: Array<{
    job_id: string;
    job_type: string;
    status: JobStatus;
    created_at: number;
    updated_at: number;
    claimed_by: string | null;
  }>;
  total: number;
}

export interface AdminRunnersResponse {
  runners: Array<{
    runner_id: string;
    name: string;
    capabilities: string[];
    last_seen: number;
    is_active: boolean;
  }>;
  total: number;
}

export interface AdminStatsResponse {
  jobs: {
    pending: number;
    claimed: number;
    in_progress: number;
    completed: number;
    failed: number;
    expired: number;
    total: number;
  };
  runners: {
    total: number;
    active: number;
  };
}

export interface AdminJobDetailResponse {
  job_id: string;
  job_type: string;
  status: JobStatus;
  input_params: any;
  created_at: number;
  updated_at: number;
  claimed_by: string | null;
  claimed_at: number | null;
  progress?: {
    current: number;
    total: number;
  };
  console_output: string;
  output_data?: any;
  error_message?: string;
  last_heartbeat: number | null;
}

export interface AdminRunnerDetailResponse {
  runner_id: string;
  name: string;
  capabilities: string[];
  registered_at: number;
  last_seen: number;
  is_active: boolean;
  jobs: Array<{
    job_id: string;
    job_type: string;
    status: JobStatus;
    created_at: number;
    updated_at: number;
  }>;
}

// Error response
export interface ErrorResponse {
  error: string;
  details?: string;
}

// Rate limiting
export interface RateLimitInfo {
  key: string;
  count: number;
  resetTime: number;
}

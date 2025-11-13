// Job statuses
export type JobStatus = 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed' | 'expired';

// API response types
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

export interface ErrorResponse {
  error: string;
  details?: string;
}

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_hash TEXT NOT NULL UNIQUE,
    job_type TEXT NOT NULL,
    input_params TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'claimed', 'in_progress', 'completed', 'failed', 'expired')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    claimed_by TEXT,
    claimed_at INTEGER,
    progress_current INTEGER,
    progress_total INTEGER,
    console_output TEXT DEFAULT '',
    output_data TEXT,
    error_message TEXT,
    last_heartbeat INTEGER,
    FOREIGN KEY (claimed_by) REFERENCES runners(id)
);

-- Runners table
CREATE TABLE IF NOT EXISTS runners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    registered_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_hash ON jobs(job_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_claimed_by ON jobs(claimed_by);
CREATE INDEX IF NOT EXISTS idx_runners_last_seen ON runners(last_seen);

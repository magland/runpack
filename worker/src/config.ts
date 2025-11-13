// Configuration constants

// Rate limiting (requests per minute)
export const RATE_LIMITS = {
  JOB_SUBMISSION: 10, // Per IP
  JOB_POLLING: 60, // Per IP
  RUNNER_HEARTBEAT: 120, // Per runner
  ADMIN: 1000, // Effectively no limit for admin
};

// Size limits (in bytes)
export const SIZE_LIMITS = {
  INPUT_PARAMS: 100 * 1024, // 100 KB
  OUTPUT_DATA: 500 * 1024, // 500 KB
  CONSOLE_OUTPUT: 1 * 1024 * 1024, // 1 MB
  ERROR_MESSAGE: 10 * 1024, // 10 KB
};

// Timeouts
export const TIMEOUTS = {
  HEARTBEAT_THRESHOLD: 90 * 1000, // 90 seconds (runner must heartbeat at least once per minute)
  RUNNER_ACTIVE_THRESHOLD: 5 * 60 * 1000, // 5 minutes (runner considered inactive if no activity)
};

// Rate limit window (in milliseconds)
export const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

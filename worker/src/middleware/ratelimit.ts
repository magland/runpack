import { RATE_LIMITS, RATE_LIMIT_WINDOW } from '../config';

// In-memory rate limit tracking (will reset on worker restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(key: string, limit: number): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(now);
  }

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (entry.count < limit) {
    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);
    return { allowed: true };
  }

  // Rate limit exceeded
  return {
    allowed: false,
    resetTime: entry.resetTime,
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get rate limit key for IP-based limiting
 */
export function getRateLimitKeyForIP(request: Request, prefix: string): string {
  // Try to get real IP from CF headers, fallback to generic key
  const ip = request.headers.get('CF-Connecting-IP') || 
              request.headers.get('X-Forwarded-For') || 
              'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Get rate limit key for runner-based limiting
 */
export function getRateLimitKeyForRunner(runnerId: string, prefix: string): string {
  return `${prefix}:${runnerId}`;
}

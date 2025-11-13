import { Env, ErrorResponse } from '../types';

export type AuthLevel = 'submit' | 'runner' | 'admin';

/**
 * Verify API key and return the authentication level
 */
export function verifyAuth(request: Request, env: Env, requiredLevel: AuthLevel): { authorized: boolean; error?: ErrorResponse } {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      authorized: false,
      error: { error: 'Missing Authorization header' },
    };
  }

  // Extract bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return {
      authorized: false,
      error: { error: 'Invalid Authorization header format. Use: Bearer <token>' },
    };
  }

  const token = parts[1];

  // Check against appropriate API key based on required level
  switch (requiredLevel) {
    case 'submit':
      if (token === env.SUBMIT_API_KEY) {
        return { authorized: true };
      }
      break;
    
    case 'runner':
      if (token === env.RUNNER_API_KEY) {
        return { authorized: true };
      }
      break;
    
    case 'admin':
      // Admin can use either admin key or runner key
      if (token === env.ADMIN_API_KEY || token === env.RUNNER_API_KEY) {
        return { authorized: true };
      }
      break;
  }

  return {
    authorized: false,
    error: { error: 'Invalid API key' },
  };
}

/**
 * Extract runner ID from request headers
 * Used to identify which runner is making the request
 */
export function getRunnerIdFromHeaders(request: Request): string | null {
  return request.headers.get('X-Runner-ID');
}

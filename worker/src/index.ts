import { Env } from './types';
import { handleRequest } from './router';

/**
 * Main Cloudflare Worker entry point
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};

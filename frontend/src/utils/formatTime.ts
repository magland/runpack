import { formatDistanceToNow } from 'date-fns';

/**
 * Format a timestamp as relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

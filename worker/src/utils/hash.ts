/**
 * Generate a deterministic hash for a job based on its type and input parameters
 * This ensures the same job type + params always produces the same hash
 */
export async function generateJobHash(jobType: string, inputParams: Record<string, any>): Promise<string> {
  // Create a canonical string representation of the job
  const canonical = JSON.stringify({
    type: jobType,
    params: sortObjectKeys(inputParams),
  });

  // Hash the canonical string using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Sort object keys recursively to ensure consistent ordering
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}

/**
 * Generate a unique ID (UUID v4)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

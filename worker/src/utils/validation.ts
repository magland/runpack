import { SIZE_LIMITS, VALIDATION } from '../config';
import { Job } from '../types';

/**
 * Validate job input parameters
 * Currently a placeholder - can be extended with actual validation logic
 */
export function validateJobInput(jobType: string, inputParams: Record<string, any>): { valid: boolean; error?: string } {
  // Check size limit
  const inputJson = JSON.stringify(inputParams);
  if (inputJson.length > SIZE_LIMITS.INPUT_PARAMS) {
    return {
      valid: false,
      error: `Input parameters exceed size limit of ${SIZE_LIMITS.INPUT_PARAMS} bytes`,
    };
  }

  // Placeholder for type-specific validation
  // In the future, this could validate based on job_type
  if (!jobType || typeof jobType !== 'string') {
    return {
      valid: false,
      error: 'Job type must be a non-empty string',
    };
  }

  if (!inputParams || typeof inputParams !== 'object') {
    return {
      valid: false,
      error: 'Input parameters must be an object',
    };
  }

  return { valid: true };
}

/**
 * Validate job output
 */
export function validateJobOutput(outputData: Record<string, any>): { valid: boolean; error?: string } {
  const outputDataStr = JSON.stringify(outputData);
  if (outputDataStr.length > SIZE_LIMITS.OUTPUT_DATA) {
    return {
      valid: false,
      error: `Output JSON exceeds size limit of ${SIZE_LIMITS.OUTPUT_DATA} bytes`,
    };
  }

  return { valid: true };
}

/**
 * Validate console output
 */
export function validateConsoleOutput(consoleOutput: string): { valid: boolean; error?: string } {
  if (consoleOutput.length > SIZE_LIMITS.CONSOLE_OUTPUT) {
    return {
      valid: false,
      error: `Console output exceeds size limit of ${SIZE_LIMITS.CONSOLE_OUTPUT} bytes`,
    };
  }

  return { valid: true };
}

/**
 * Validate error message
 */
export function validateErrorMessage(errorMessage: string): { valid: boolean; error?: string } {
  if (errorMessage.length > SIZE_LIMITS.ERROR_MESSAGE) {
    return {
      valid: false,
      error: `Error message exceeds size limit of ${SIZE_LIMITS.ERROR_MESSAGE} bytes`,
    };
  }

  return { valid: true };
}

/**
 * Recursively extract all figpack_url field values from an object
 */
function extractFigpackUrls(obj: any): string[] {
  const urls: string[] = [];
  
  if (obj === null || obj === undefined) {
    return urls;
  }
  
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'figpack_url' && typeof value === 'string') {
        urls.push(value);
      } else if (typeof value === 'object') {
        urls.push(...extractFigpackUrls(value));
      }
    }
  }
  
  return urls;
}

/**
 * Validate figpack URL format and return figpack.json URL
 * Returns null if URL is invalid
 */
function validateFigpackUrl(url: string): string | null {
  if (!url.endsWith('/index.html')) {
    return null;
  }
  
  // Replace index.html with figpack.json
  return url.replace(/\/index\.html$/, '/figpack.json');
}

/**
 * Fetch figpack.json and check if it's still valid (not expired)
 * Returns true if not deleted and (pinned or not expired), false otherwise
 */
async function checkFigpackExpiration(figpackJsonUrl: string): Promise<boolean> {
  try {
    const response = await fetch(figpackJsonUrl);
    
    if (!response.ok) {
      // figpack.json not found or error
      return false;
    }
    
    const figpackData = await response.json() as { deleted?: boolean, pinned?: boolean; expiration?: number };

    console.log('Fetched figpack.json data for validation:', figpackData);

    if (figpackData.deleted) {
      return false;
    }
    
    // If pinned, it's valid
    if (figpackData.pinned === true) {
      return true;
    }
    
    // Check expiration timestamp
    if (typeof figpackData.expiration === 'number') {
      return figpackData.expiration > Date.now();
    }
    
    // If neither pinned nor expiration is set, consider it invalid
    return false;
  } catch (error) {
    // Network error or JSON parse error
    return false;
  }
}

/**
 * Validate if job result is still valid
 * Checks if figpack URLs in output_data are still accessible and not expired
 */
export async function validateJobResult(job: Job): Promise<boolean> {
  // Parse output_data
  if (!job.output_data) {
    return true;
  }
  
  let outputData: any;
  try {
    outputData = JSON.parse(job.output_data);
  } catch (error) {
    // Invalid JSON, consider it invalid
    return false;
  }
  
  // Extract all figpack_url fields
  const figpackUrls = extractFigpackUrls(outputData);

  console.log('Extracted figpack URLs for validation:', figpackUrls);
  
  // If no figpack_url fields, result is valid
  if (figpackUrls.length === 0) {
    return true;
  }
  
  // Validate each figpack URL
  for (const url of figpackUrls) {
    // Validate URL format
    console.log('Validating figpack URL:', url);
    const figpackJsonUrl = validateFigpackUrl(url);
    if (!figpackJsonUrl) {
      return false;
    }
    
    // Check if figpack.json exists and is not expired
    const isValid = await checkFigpackExpiration(figpackJsonUrl);
    if (!isValid) {
      return false;
    }
  }
  
  return true;
}

export * from './api.js';
export * from './dashboard.js';
export * from './meta.js';

/**
 * Runtime validation helper — checks that an unknown value has expected keys.
 * Throws with a descriptive error if validation fails.
 */
export function validateApiResponse<T>(
  data: unknown,
  requiredKeys: string[],
  endpointName: string
): T {
  if (data === null || data === undefined) {
    throw new Error(`${endpointName}: response is ${data}`);
  }

  if (typeof data !== 'object') {
    throw new Error(`${endpointName}: expected object, got ${typeof data}`);
  }

  const obj = data as Record<string, unknown>;
  const missingKeys = requiredKeys.filter((key) => !(key in obj));

  if (missingKeys.length > 0) {
    throw new Error(
      `${endpointName}: missing required keys: ${missingKeys.join(', ')}`
    );
  }

  return data as T;
}

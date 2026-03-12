import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dirname, '../../data');

/** Delay for the given number of milliseconds */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with exponential backoff retry.
 * Retries 3 times with delays of 2s, 8s, 32s.
 */
export async function fetchWithRetry(
  url: string,
  endpointName: string,
  maxRetries = 3
): Promise<unknown> {
  const delays = [2000, 8000, 32000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (attempt < maxRetries) {
        const waitMs = delays[attempt] ?? 32000;
        console.warn(
          `[${endpointName}] Attempt ${attempt + 1} failed: ${errMsg}. Retrying in ${waitMs / 1000}s...`
        );
        await delay(waitMs);
      } else {
        console.error(
          `[${endpointName}] All ${maxRetries + 1} attempts failed: ${errMsg}`
        );
        throw new Error(`${endpointName} fetch failed after ${maxRetries + 1} attempts: ${errMsg}`);
      }
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error(`${endpointName}: unexpected end of retry loop`);
}

/** Write JSON to a file in the data directory. Creates directories as needed. */
export function writeJson(relativePath: string, data: unknown): void {
  const fullPath = path.join(DATA_DIR, relativePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  Wrote ${relativePath}`);
}

/** Read JSON from a file in the data directory. Returns null if file doesn't exist. */
export function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(DATA_DIR, relativePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Get the data directory path */
export function getDataDir(): string {
  return DATA_DIR;
}

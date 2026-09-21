export interface RetryOptions {
  maxAttempts?: number;
  /** Fixed backoff used for 429s (rate limits are usually windowed, not exponential). */
  rateLimitBackoffMs?: number;
  serverErrorBaseBackoffMs?: number;
  maxServerErrorBackoffMs?: number;
  onRetry?: (info: { attempt: number; maxAttempts: number; statusCode?: number; delayMs: number }) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, "onRetry">> = {
  maxAttempts: 8,
  rateLimitBackoffMs: 20_000,
  serverErrorBaseBackoffMs: 2_000,
  maxServerErrorBackoffMs: 30_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Different SDKs surface the HTTP status under different property names
 * (Voyage: `statusCode`, Groq: `status`), so check both. */
function getStatusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const candidate = err as { statusCode?: number; status?: number };
  return candidate.statusCode ?? candidate.status;
}

/**
 * Retries on 429 (rate limit) and 5xx (transient server error) only.
 * Anything else - bad request, auth failure, invalid input - fails
 * immediately, since retrying it would never succeed.
 */
export async function callWithRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULTS, ...options };

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const statusCode = getStatusCode(err);
      const isRateLimited = statusCode === 429;
      const isServerError = statusCode !== undefined && statusCode >= 500;

      if ((!isRateLimited && !isServerError) || attempt === opts.maxAttempts) {
        throw err;
      }

      const delayMs = isRateLimited
        ? opts.rateLimitBackoffMs
        : Math.min(opts.serverErrorBaseBackoffMs * 2 ** (attempt - 1), opts.maxServerErrorBackoffMs);

      options.onRetry?.({ attempt, maxAttempts: opts.maxAttempts, statusCode, delayMs });
      await sleep(delayMs);
    }
  }
  throw new Error("unreachable: retry loop exhausted without returning or throwing");
}

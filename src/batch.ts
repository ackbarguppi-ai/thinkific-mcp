/**
 * Request batching utility for optimizing multiple API calls.
 *
 * Batches multiple requests to the same endpoint and executes them
 * efficiently using the Thinkific API's bulk operations where available.
 *
 * @module batch
 */

interface BatchEntry<T, R> {
  key: string;
  params: T;
  resolve: (value: R) => void;
  reject: (reason: unknown) => void;
  timestamp: number;
}

interface BatcherConfig<T, R> {
  /** Maximum number of requests to batch together */
  maxBatchSize: number;
  /** Maximum time to wait before executing batch (ms) */
  maxWaitMs: number;
  /** Function to execute the batched requests */
  execute: (items: T[]) => Promise<Map<string, R>>;
  /** Function to generate a unique key for each item */
  keyFn: (item: T) => string;
}

/**
 * Creates a batching function that groups multiple requests together.
 * Automatically flushes when batch size or wait time is reached.
 */
export function createBatcher<T, R>(config: BatcherConfig<T, R>): (params: T) => Promise<R> {
  let batch: BatchEntry<T, R>[] = [];
  let flushTimeout: NodeJS.Timeout | null = null;

  async function flush(): Promise<void> {
    if (batch.length === 0) return;

    const currentBatch = batch;
    batch = [];
    flushTimeout = null;

    const items = currentBatch.map(entry => entry.params);

    try {
      const results = await config.execute(items);

      for (const entry of currentBatch) {
        const result = results.get(entry.key);
        if (result !== undefined) {
          entry.resolve(result);
        } else {
          entry.reject(new Error(`No result found for key: ${entry.key}`));
        }
      }
    } catch (err) {
      for (const entry of currentBatch) {
        entry.reject(err);
      }
    }
  }

  function scheduleFlush(): void {
    if (flushTimeout === null) {
      flushTimeout = setTimeout(() => flush(), config.maxWaitMs);
    }
  }

  return function addToBatch(params: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const key = config.keyFn(params);
      const entry: BatchEntry<T, R> = {
        key,
        params,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      batch.push(entry);

      if (batch.length >= config.maxBatchSize) {
        // Flush immediately when batch is full
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
        flush();
      } else {
        scheduleFlush();
      }
    });
  };
}

/**
 * Request coalescing - deduplicates in-flight identical requests.
 * If the same request is made multiple times while one is in flight,
 * all callers receive the same result.
 */
export class RequestCoalescer<T, R> {
  private inFlight = new Map<string, Promise<R>>();

  constructor(private keyFn: (params: T) => string) {}

  async execute(params: T, fn: (params: T) => Promise<R>): Promise<R> {
    const key = this.keyFn(params);

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn(params).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.inFlight.clear();
  }
}

/**
 * Debounced function wrapper - delays execution until after wait period
 * of no new calls. Useful for rapid successive calls.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return function debounced(...args: Parameters<T>): Promise<ReturnType<T>> {
    pendingArgs = args;

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      const argsToUse = pendingArgs;
      const resolveToUse = pendingResolve;
      const rejectToUse = pendingReject;

      pendingArgs = null;
      pendingPromise = null;
      pendingResolve = null;
      pendingReject = null;
      timeout = null;

      try {
        const result = fn(...argsToUse!) as ReturnType<T>;
        resolveToUse!(result);
      } catch (err) {
        rejectToUse!(err);
      }
    }, waitMs);

    return pendingPromise;
  };
}

/**
 * Throttled function wrapper - limits execution to once per period.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number,
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let lastCall = 0;
  let pendingPromise: Promise<ReturnType<T>> | null = null;

  return async function throttled(...args: Parameters<T>): Promise<ReturnType<T> | undefined> {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= limitMs) {
      lastCall = now;
      pendingPromise = Promise.resolve(fn(...args) as ReturnType<T>);
      return pendingPromise;
    }

    // Return the pending promise if we're within the throttle window
    return pendingPromise ?? undefined;
  };
}

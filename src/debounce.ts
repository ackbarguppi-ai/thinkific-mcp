/**
 * Debounce and throttle utilities for the Thinkific MCP server.
 *
 * Prevents rapid successive API calls and optimizes tool execution.
 *
 * @module debounce
 */

interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
  cancel(): void;
  flush(): Promise<ReturnType<T> | undefined>;
}

interface DebounceOptions {
  /** Delay in milliseconds */
  wait: number;
  /** Execute on the leading edge */
  leading?: boolean;
  /** Execute on the trailing edge */
  trailing?: boolean;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after `wait` milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: DebounceOptions
): DebouncedFunction<T> {
  const { wait, leading = false, trailing = true } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T> | undefined;
  let isLeadingInvoked = false;

  const debounced = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastArgs = args;

    if (!timeoutId) {
      if (leading && !isLeadingInvoked) {
        isLeadingInvoked = true;
        lastResult = fn(...args) as ReturnType<T>;
        return lastResult;
      }
    } else {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (trailing && lastArgs) {
          lastResult = fn(...lastArgs) as ReturnType<T>;
          resolve(lastResult);
        }
        timeoutId = null;
        lastArgs = null;
        isLeadingInvoked = false;
      }, wait);
    });
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    isLeadingInvoked = false;
  };

  debounced.flush = async () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      if (lastArgs) {
        lastResult = fn(...lastArgs) as ReturnType<T>;
      }
      timeoutId = null;
      lastArgs = null;
      isLeadingInvoked = false;
    }
    return lastResult;
  };

  return debounced;
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every `wait` milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => ReturnType<T> {
  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>): ReturnType<T> => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastCallTime >= wait) {
      // Execute immediately if enough time has passed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCallTime = now;
      return fn(...args) as ReturnType<T>;
    }

    // Schedule execution after the wait period
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        fn(...(lastArgs as Parameters<T>));
      }, wait - (now - lastCallTime));
    }

    return undefined as ReturnType<T>;
  };

  return throttled;
}

/**
 * Memoize a function to cache its results based on arguments.
 * Uses a simple LRU cache with a size limit.
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { maxSize?: number; ttl?: number }
): T {
  const maxSize = options?.maxSize ?? 100;
  const ttl = options?.ttl ?? 60000;

  interface CacheEntry {
    result: ReturnType<T>;
    expiresAt: number;
    key: string;
  }

  const cache = new Map<string, CacheEntry>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const entry = cache.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      // Move to end (most recently used)
      cache.delete(key);
      cache.set(key, entry);
      return entry.result;
    }

    // Remove expired entry if exists
    if (entry) {
      cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
      key,
    });

    return result;
  };

  return memoized as T;
}

/**
 * Batch multiple requests together and execute them in parallel.
 * Useful for aggregating multiple similar requests.
 */
export class Batcher<T, R> {
  private queue: Array<{ item: T; resolve: (result: R) => void; reject: (err: Error) => void }> = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly maxWaitMs: number;
  private readonly maxBatchSize: number;
  private readonly processor: (items: T[]) => Promise<R[]>;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    options: { maxWaitMs?: number; maxBatchSize?: number } = {}
  ) {
    this.processor = processor;
    this.maxWaitMs = options.maxWaitMs ?? 50;
    this.maxBatchSize = options.maxBatchSize ?? 10;
  }

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.maxWaitMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);
    if (batch.length === 0) return;

    try {
      const items = batch.map(b => b.item);
      const results = await this.processor(items);

      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      batch.forEach(b => b.reject(error));
    }
  }

  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.queue = [];
  }
}

/**
 * Request batching utility for the Thinkific MCP server.
 * 
 * Batches multiple API requests together for improved throughput
 * when fetching related data.
 */

interface BatchRequest<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

interface BatchOptions {
  maxBatchSize: number;
  maxWaitMs: number;
}

export class RequestBatcher {
  private queue: BatchRequest<unknown>[] = [];
  private timer: NodeJS.Timeout | null = null;
  private options: BatchOptions;

  constructor(options: Partial<BatchOptions> = {}) {
    this.options = {
      maxBatchSize: 10,
      maxWaitMs: 50,
      ...options,
    };
  }

  /**
   * Add a request to the batch queue.
   * Returns a promise that resolves when the request is executed.
   */
  add<T>(id: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.options.maxWaitMs);
      }
    });
  }

  /**
   * Execute all pending requests in parallel.
   */
  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, this.options.maxBatchSize);
    if (batch.length === 0) return;

    // Execute all requests in parallel
    Promise.all(
      batch.map((req) =>
        req.fn()
          .then((result) => req.resolve(result))
          .catch((err) => req.reject(err instanceof Error ? err : new Error(String(err))))
      )
    );
  }

  /**
   * Clear all pending requests.
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
  }
}

// Global batcher instance for reuse
export const globalBatcher = new RequestBatcher();

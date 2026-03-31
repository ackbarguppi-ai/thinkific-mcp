/**
 * Performance metrics and logging utilities for the MCP server.
 *
 * Tracks API call latencies, cache hit rates, and tool execution times.
 *
 * @module metrics
 */

export interface MetricsSnapshot {
  apiCalls: {
    total: number;
    byMethod: Record<string, number>;
    averageLatency: number;
    p95Latency: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  tools: {
    totalCalls: number;
    byTool: Record<string, number>;
    averageExecutionTime: number;
  };
}

class MetricsCollector {
  private apiCalls: Array<{ method: string; path: string; latency: number; error: boolean; cached: boolean }> = [];
  private toolCalls: Array<{ tool: string; latency: number }> = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly maxSamples = 1000;

  recordApiCall(method: string, path: string, latency: number, error: boolean, cached: boolean): void {
    this.apiCalls.push({ method, path, latency, error, cached });
    if (this.apiCalls.length > this.maxSamples) {
      this.apiCalls.shift();
    }
  }

  recordToolCall(tool: string, latency: number): void {
    this.toolCalls.push({ tool, latency });
    if (this.toolCalls.length > this.maxSamples) {
      this.toolCalls.shift();
    }
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getSnapshot(): MetricsSnapshot {
    const totalCalls = this.apiCalls.length;
    const totalToolCalls = this.toolCalls.length;

    // Calculate API metrics
    const byMethod: Record<string, number> = {};
    let totalLatency = 0;
    let errors = 0;
    const latencies: number[] = [];

    for (const call of this.apiCalls) {
      byMethod[call.method] = (byMethod[call.method] || 0) + 1;
      totalLatency += call.latency;
      latencies.push(call.latency);
      if (call.error) errors++;
    }

    // Calculate P95 latency
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || 0;

    // Calculate tool metrics
    const byTool: Record<string, number> = {};
    let totalToolLatency = 0;
    for (const call of this.toolCalls) {
      byTool[call.tool] = (byTool[call.tool] || 0) + 1;
      totalToolLatency += call.latency;
    }

    const totalCache = this.cacheHits + this.cacheMisses;

    return {
      apiCalls: {
        total: totalCalls,
        byMethod,
        averageLatency: totalCalls > 0 ? totalLatency / totalCalls : 0,
        p95Latency,
        errors,
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: totalCache > 0 ? (this.cacheHits / totalCache) * 100 : 0,
      },
      tools: {
        totalCalls: totalToolCalls,
        byTool,
        averageExecutionTime: totalToolCalls > 0 ? totalToolLatency / totalToolCalls : 0,
      },
    };
  }

  reset(): void {
    this.apiCalls = [];
    this.toolCalls = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  formatReport(): string {
    const m = this.getSnapshot();
    const lines = [
      "📊 Performance Metrics",
      "",
      `API Calls: ${m.apiCalls.total} (avg: ${m.apiCalls.averageLatency.toFixed(1)}ms, p95: ${m.apiCalls.p95Latency.toFixed(1)}ms, errors: ${m.apiCalls.errors})`,
      `Cache: ${m.cache.hitRate.toFixed(1)}% hit rate (${m.cache.hits} hits, ${m.cache.misses} misses)`,
      `Tool Calls: ${m.tools.totalCalls} (avg: ${m.tools.averageExecutionTime.toFixed(1)}ms)`,
    ];

    if (Object.keys(m.apiCalls.byMethod).length > 0) {
      lines.push("", "API Calls by Method:");
      for (const [method, count] of Object.entries(m.apiCalls.byMethod).sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${method}: ${count}`);
      }
    }

    if (Object.keys(m.tools.byTool).length > 0) {
      lines.push("", "Top Tools:");
      const sorted = Object.entries(m.tools.byTool).sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [tool, count] of sorted) {
        lines.push(`  ${tool}: ${count}`);
      }
    }

    return lines.join("\n");
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

/**
 * Wrap a function with performance tracking
 */
export function timed<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T {
  return ((...args: unknown[]) => {
    const start = performance.now();
    try {
      const result = fn(...args);
      metrics.recordToolCall(name, performance.now() - start);
      return result;
    } catch (err) {
      metrics.recordToolCall(name, performance.now() - start);
      throw err;
    }
  }) as T;
}

/**
 * Async version of timed wrapper
 */
export function timedAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T
): T {
  return (async (...args: unknown[]) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      metrics.recordToolCall(name, performance.now() - start);
      return result;
    } catch (err) {
      metrics.recordToolCall(name, performance.now() - start);
      throw err;
    }
  }) as T;
}

/**
 * Enhanced cache implementation with TTL, LRU eviction, and size limits.
 *
 * @module cache
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  defaultTTLMs: number;
  maxSize: number;
  cleanupIntervalMs: number;
}

export class EnhancedCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private options: CacheOptions;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private hits = 0;
  private misses = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      defaultTTLMs: 5000,
      maxSize: 1000,
      cleanupIntervalMs: 60000,
      ...options,
    };

    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), this.options.cleanupIntervalMs);
  }

  /**
   * Get a value from the cache.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access stats for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;
    return entry.data as T;
  }

  /**
   * Set a value in the cache.
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.options.defaultTTLMs),
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  /**
   * Clean up expired entries.
   */
  cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
  }

  /**
   * Stop the cleanup timer.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Evict the least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/** Generate cache key from request parameters */
export function generateCacheKey(
  method: string,
  path: string,
  params?: Record<string, unknown>
): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${method}:${path}:${paramsStr}`;
}

/** Global cache instance */
export const globalCache = new EnhancedCache({
  defaultTTLMs: 5000,
  maxSize: 1000,
  cleanupIntervalMs: 60000,
});

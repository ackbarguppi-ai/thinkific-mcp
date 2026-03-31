/**
 * Optimized HTTP client with connection pooling, caching, compression,
 * request coalescing, and performance instrumentation.
 *
 * @module client
 */

import https from 'https';
import { URL } from 'url';
import zlib from 'zlib';
import { promisify } from 'util';
import { metrics } from './metrics.js';

const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

import {
  ThinkificAuthConfig,
  ThinkificApiError,
  PaginatedResponse,
} from "./types.js";

const BASE_URL = "https://api.thinkific.com/api/public/v1";
const GQL_URL = "https://api.thinkific.com/stable/graphql";

/** Default back-off when no Retry-After header is provided (ms). */
const DEFAULT_BACKOFF_MS = 2_000;

/** Connection pool settings for optimal performance */
const HTTP_AGENT_OPTIONS = {
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 30000,
  scheduling: 'lifo' as const,
};

/** Global connection agents for reuse across all instances */
const httpsAgent = new https.Agent(HTTP_AGENT_OPTIONS);

// ---------------------------------------------------------------------------
// Cache implementation
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs: number = 5000) {
    this.defaultTTL = defaultTTLMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      metrics.recordCacheMiss();
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      metrics.recordCacheMiss();
      return undefined;
    }
    metrics.recordCacheHit();
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

/** Global cache instance */
const globalCache = new SimpleCache(5000);
setInterval(() => globalCache.cleanup(), 60000);

// ---------------------------------------------------------------------------
// Request coalescing - deduplicate in-flight identical requests
// ---------------------------------------------------------------------------

class RequestCoalescer<T, R> {
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

// ---------------------------------------------------------------------------
// Client options interface
// ---------------------------------------------------------------------------

export interface ClientOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  maxRetries?: number;
  requestTimeout?: number;
}

// ---------------------------------------------------------------------------
// Auth resolution
// ---------------------------------------------------------------------------

export function resolveAuth(): ThinkificAuthConfig {
  const oauthToken = process.env.THINKIFIC_OAUTH_TOKEN;
  if (oauthToken) {
    return { mode: "oauth", oauthToken };
  }

  const apiKey = process.env.THINKIFIC_API_KEY;
  const subdomain = process.env.THINKIFIC_SUBDOMAIN;

  if (apiKey && subdomain) {
    return { mode: "api_key", apiKey, subdomain };
  }

  throw new Error(
    "Thinkific authentication not configured. " +
      "Set THINKIFIC_API_KEY + THINKIFIC_SUBDOMAIN for API-key auth, " +
      "or THINKIFIC_OAUTH_TOKEN for OAuth. " +
      "See README.md for details.",
  );
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function gqlAuthHeaders(auth: ThinkificAuthConfig): Record<string, string> {
  let bearer: string;
  if (auth.mode === "oauth") {
    bearer = auth.oauthToken!;
  } else {
    bearer = auth.apiKey ?? "";
  }
  return {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    "User-Agent": "ThinkificMCP/1.0 (Node.js)",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
  };
}

function authHeaders(auth: ThinkificAuthConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ThinkificMCP/1.0 (Node.js)",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
  };

  if (auth.mode === "oauth") {
    headers.Authorization = `Bearer ${auth.oauthToken}`;
  } else {
    headers["X-Auth-API-Key"] = auth.apiKey!;
    headers["X-Auth-Subdomain"] = auth.subdomain!;
  }
  return headers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_BACKOFF_MS;
  const asNum = Number(header);
  if (!Number.isNaN(asNum)) return asNum * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return DEFAULT_BACKOFF_MS;
}

/** Generate cache key from request parameters */
function generateCacheKey(method: string, path: string, params?: Record<string, unknown>): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${method}:${path}:${paramsStr}`;
}

// ---------------------------------------------------------------------------
// Optimized ThinkificClient
// ---------------------------------------------------------------------------

export class ThinkificClient {
  private auth: ThinkificAuthConfig;
  private cache: SimpleCache;
  private enableCache: boolean;
  private maxRetries: number;
  private requestTimeout: number;
  private requestCoalescer: RequestCoalescer<
    { method: string; path: string; params?: Record<string, unknown> },
    unknown
  >;

  constructor(auth: ThinkificAuthConfig, options?: ClientOptions) {
    this.auth = auth;
    this.enableCache = options?.enableCache ?? true;
    this.maxRetries = options?.maxRetries ?? 3;
    this.requestTimeout = options?.requestTimeout ?? 30000;
    this.cache = options?.cacheTTL ? new SimpleCache(options.cacheTTL) : globalCache;
    this.requestCoalescer = new RequestCoalescer((req) => 
      generateCacheKey(req.method, req.path, req.params)
    );
  }

  /**
   * Execute an authenticated request with connection pooling, compression, caching,
   * and request coalescing.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
    options?: { skipCache?: boolean; cacheTTL?: number }
  ): Promise<T> {
    // Check cache for GET requests
    const cacheKey = generateCacheKey(method, path, params);
    if (this.enableCache && method === 'GET' && !options?.skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Use request coalescing for GET requests to deduplicate in-flight requests
    if (method === 'GET') {
      return this.requestCoalescer.execute(
        { method, path, params },
        async () => this.executeRequest<T>(method, path, body, params, options, cacheKey)
      ) as Promise<T>;
    }

    return this.executeRequest<T>(method, path, body, params, options, cacheKey);
  }

  private async executeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
    options?: { skipCache?: boolean; cacheTTL?: number },
    cacheKey?: string
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers = authHeaders(this.auth);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const startTime = performance.now();
      let error = false;
      let cached = false;

      try {
        const response = await this.makeRequest<T>(url, method, headers, body);
        
        // Cache successful GET responses
        if (this.enableCache && method === 'GET' && !options?.skipCache && cacheKey) {
          this.cache.set(cacheKey, response, options?.cacheTTL);
        }
        
        metrics.recordApiCall(method, path, performance.now() - startTime, false, cached);
        return response;
      } catch (err) {
        error = true;
        metrics.recordApiCall(method, path, performance.now() - startTime, true, false);

        if (err instanceof ThinkificApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${this.maxRetries} retries`);
  }

  /** Make a single HTTP request with connection pooling and compression */
  private makeRequest<T>(
    url: URL,
    method: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const reqOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers,
        agent: httpsAgent,
        timeout: this.requestTimeout,
      };

      const req = https.request(reqOptions, async (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        
        res.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const encoding = res.headers['content-encoding'];
            const decompressed = await this.decompressBody(buffer, encoding || null);
            
            const status = res.statusCode || 0;
            
            if (status === 429) {
              const wait = parseRetryAfter(res.headers['retry-after'] as string);
              await sleep(wait);
              reject(new Error('Rate limited'));
              return;
            }
            
            if (status >= 500) {
              reject(new Error(`Server error: ${status}`));
              return;
            }
            
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              let errBody: unknown;
              try {
                errBody = JSON.parse(decompressed.toString());
              } catch {
                errBody = decompressed.toString();
              }
              reject(new ThinkificApiError(
                `Thinkific API ${method} ${url.pathname} returned ${status}: ${JSON.stringify(errBody)}`,
                status,
                errBody,
                url.pathname,
              ));
              return;
            }
            
            if (status === 204) {
              resolve(undefined as unknown as T);
              return;
            }
            
            const data = JSON.parse(decompressed.toString()) as T;
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  private async decompressBody(body: Buffer, encoding: string | null): Promise<Buffer> {
    if (!encoding) return body;
    
    switch (encoding.toLowerCase()) {
      case 'gzip':
        return gunzip(body);
      case 'deflate':
        return deflate(body);
      case 'br':
        return brotliDecompress(body);
      default:
        return body;
    }
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, options?: { skipCache?: boolean; cacheTTL?: number }): Promise<T> {
    return this.request<T>("GET", path, undefined, params, options);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Execute a GraphQL operation with connection pooling and compression.
   */
  async gql<T>(
    operationName: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const cacheKey = `gql:${operationName}:${JSON.stringify(variables)}`;
    if (this.enableCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    const headers = gqlAuthHeaders(this.auth);
    const body = JSON.stringify({ operationName, query, variables: variables ?? {} });
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const startTime = performance.now();

      try {
        const url = new URL(GQL_URL);
        const result = await new Promise<T>((resolve, reject) => {
          const reqOptions: https.RequestOptions = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers,
            agent: httpsAgent,
            timeout: this.requestTimeout,
          };

          const req = https.request(reqOptions, async (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            
            res.on('end', async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const encoding = res.headers['content-encoding'];
                const decompressed = await this.decompressBody(buffer, encoding || null);
                
                const json = JSON.parse(decompressed.toString()) as { data?: T; errors?: Array<{ message: string }> };

                if (json.errors?.length) {
                  const msgs = json.errors.map((e) => e.message).join("; ");
                  reject(new ThinkificApiError(
                    `GraphQL error in ${operationName}: ${msgs}`,
                    200,
                    json.errors,
                    "graphql",
                  ));
                  return;
                }

                resolve(json.data as T);
              } catch (err) {
                reject(err);
              }
            });
          });

          req.on('error', reject);
          req.write(body);
          req.end();
        });

        metrics.recordApiCall('GQL', operationName, performance.now() - startTime, false, false);

        if (this.enableCache) {
          this.cache.set(cacheKey, result);
        }
        return result;
      } catch (err) {
        metrics.recordApiCall('GQL', operationName, performance.now() - startTime, true, false);
        if (err instanceof ThinkificApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error(`GraphQL ${operationName} failed after ${this.maxRetries} retries`);
  }

  /**
   * Fetch a single page from a list endpoint.
   */
  async list<T>(
    path: string,
    page: number = 1,
    limit: number = 25,
    extra?: Record<string, string | number | boolean | undefined>,
  ): Promise<PaginatedResponse<T>> {
    return this.get<PaginatedResponse<T>>(path, {
      page,
      limit,
      ...extra,
    });
  }

  /**
   * Fetch all pages with optimized concurrent requests.
   * Uses connection pooling and request coalescing for maximum efficiency.
   */
  async listAll<T>(
    path: string,
    limit: number = 250,
    extra?: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    // First request to get total count - may be served from cache
    const firstPage = await this.list<T>(path, 1, limit, extra);
    const totalPages = firstPage.meta.pagination.total_pages;
    
    if (totalPages <= 1) {
      return firstPage.items;
    }
    
    // Fetch remaining pages in parallel with controlled concurrency
    const allItems = [...firstPage.items];
    const batchSize = 5; // Process 5 pages at a time to avoid overwhelming the API
    
    for (let batchStart = 2; batchStart <= totalPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, totalPages);
      const promises: Promise<PaginatedResponse<T>>[] = [];
      
      for (let page = batchStart; page <= batchEnd; page++) {
        promises.push(this.list<T>(path, page, limit, extra));
      }
      
      const results = await Promise.all(promises);
      for (const result of results) {
        allItems.push(...result.items);
      }
    }
    
    return allItems;
  }

  /** Get cache statistics */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: metrics.getSnapshot().cache.hitRate,
    };
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
  }
}

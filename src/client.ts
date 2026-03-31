/**
 * Thinkific REST API client.
 *
 * Handles authentication (API Key or OAuth), pagination helpers,
 * rate-limit back-off, and structured error responses.
 *
 * @module client
 */

import {
  ThinkificAuthConfig,
  ThinkificApiError,
  PaginatedResponse,
} from "./types.js";

const BASE_URL = "https://api.thinkific.com/api/public/v1";

/** Maximum automatic retries on 429 / 5xx responses. */
const MAX_RETRIES = 3;

/** Default back-off when no Retry-After header is provided (ms). */
const DEFAULT_BACKOFF_MS = 2_000;

// ---------------------------------------------------------------------------
// Auth resolution
// ---------------------------------------------------------------------------

/**
 * Resolve auth configuration from environment variables.
 *
 * Precedence:
 *   1. `THINKIFIC_OAUTH_TOKEN`  → OAuth Bearer mode
 *   2. `THINKIFIC_API_KEY` + `THINKIFIC_SUBDOMAIN` → API Key mode
 *
 * @throws if neither auth method is fully configured.
 */
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

function authHeaders(auth: ThinkificAuthConfig): Record<string, string> {
  if (auth.mode === "oauth") {
    return {
      Authorization: `Bearer ${auth.oauthToken}`,
      "Content-Type": "application/json",
      "User-Agent": "ThinkificMCP/1.0 (Node.js)",
      Accept: "application/json",
    };
  }
  return {
    "X-Auth-API-Key": auth.apiKey!,
    "X-Auth-Subdomain": auth.subdomain!,
    "Content-Type": "application/json",
    "User-Agent": "ThinkificMCP/1.0 (Node.js)",
    Accept: "application/json",
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse the `Retry-After` header.
 * The header value may be seconds (integer) or an HTTP-date string.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_BACKOFF_MS;
  const asNum = Number(header);
  if (!Number.isNaN(asNum)) return asNum * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return DEFAULT_BACKOFF_MS;
}

// ---------------------------------------------------------------------------
// ThinkificClient
// ---------------------------------------------------------------------------

/**
 * Low-level Thinkific API client with retry/backoff and pagination.
 */
export class ThinkificClient {
  private auth: ThinkificAuthConfig;

  constructor(auth: ThinkificAuthConfig) {
    this.auth = auth;
  }

  // ── Core request method ──────────────────────────────────────────────

  /**
   * Execute an authenticated request against the Thinkific API.
   *
   * Automatically retries on 429 (rate limit) and 5xx errors up to
   * {@link MAX_RETRIES} times with exponential back-off.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
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

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Rate-limited — back off and retry
        if (resp.status === 429) {
          const wait = parseRetryAfter(resp.headers.get("Retry-After"));
          if (attempt < MAX_RETRIES) {
            await sleep(wait);
            continue;
          }
        }

        // Server error — exponential backoff retry
        if (resp.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }

        // Not OK and not retryable
        if (!resp.ok) {
          let errBody: unknown;
          try {
            errBody = await resp.json();
          } catch {
            errBody = await resp.text().catch(() => null);
          }
          throw new ThinkificApiError(
            `Thinkific API ${method} ${path} returned ${resp.status}: ${JSON.stringify(errBody)}`,
            resp.status,
            errBody,
            path,
          );
        }

        // 204 No Content
        if (resp.status === 204) {
          return undefined as unknown as T;
        }

        return (await resp.json()) as T;
      } catch (err) {
        if (err instanceof ThinkificApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await sleep(DEFAULT_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${MAX_RETRIES} retries`);
  }

  // ── Convenience methods ──────────────────────────────────────────────

  /** HTTP GET with optional query params. */
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  /** HTTP POST with JSON body. */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /** HTTP PUT with JSON body. */
  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  // ── Paginated list helper ────────────────────────────────────────────

  /**
   * Fetch a single page from a list endpoint.
   *
   * @param path   - API path (e.g. `/courses`)
   * @param page   - 1-based page number
   * @param limit  - items per page (API default is 25, max 250)
   * @param extra  - additional query parameters
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
}

import { API_BASE, env } from '@/lib/env';
import type { User } from '@/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RefreshResponse {
  accessToken: string;
  user: User;
}

// Access token lives in memory only (never localStorage).
let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;
/** When set (admin area), Bearer tokens come from Clerk instead of our own refresh flow. */
let tokenProvider: (() => Promise<string | null>) | null = null;
export const setTokenProvider = (fn: (() => Promise<string | null>) | null) => {
  tokenProvider = fn;
};
let inflightRefresh: Promise<RefreshResponse | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setAuthLostHandler = (fn: () => void) => {
  onAuthLost = fn;
};

export function refreshSession(): Promise<RefreshResponse | null> {
  if (env.mock) return import('./mock').then((m) => m.mockRefresh());
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!res.ok) return null;
        const data = (await res.json()) as RefreshResponse;
        accessToken = data.accessToken;
        return data;
      } catch {
        return null;
      } finally {
        inflightRefresh = null;
      }
    })();
  }
  return inflightRefresh;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  /** false for public endpoints (login) — skips Bearer + 401 refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const token = tokenProvider ? await tokenProvider() : accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Something went wrong');
  }
  return data as T;
}

export async function api<T = void>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (env.mock) {
    const { mockRequest } = await import('./mock');
    return mockRequest<T>(path, opts);
  }
  let res: Response;
  try {
    res = await send(path, opts);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 401 && opts.auth !== false && tokenProvider) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your admin session has expired. Sign in again.');
  }
  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      onAuthLost?.();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    }
    res = await send(path, opts);
  }
  return parse<T>(res);
}

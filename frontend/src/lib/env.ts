export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws',
  /** Dev only: fake the backend in the browser. Never enable in production. */
  mock: process.env.NEXT_PUBLIC_MOCK === 'true',
} as const;

export const API_BASE = `${env.apiUrl}/api/v1`;

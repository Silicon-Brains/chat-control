import { QueryClient, isServer } from '@tanstack/react-query';

const make = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  });

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return make();
  return (browserClient ??= make());
}

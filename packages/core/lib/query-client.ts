import { QueryClient, isServer } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;

/**
 * The query client every piece of async state on the page shares: one per tab, and a fresh one per server render.
 *
 * An answer is fresh for half a minute and asked again when the window comes
 * back into focus; a failed read is retried once before its error shows. Work
 * runs offline too, so a dropped connection fails with its reason rather than
 * waiting silently. React roots the editor mounts beside the page wrap
 * themselves in this same client.
 *
 * @example <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
 */
export function getQueryClient() {
  if (isServer) return createClient();
  browserClient ??= createClient();
  return browserClient;
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, networkMode: "always" },
      mutations: { networkMode: "always" },
    },
  });
}

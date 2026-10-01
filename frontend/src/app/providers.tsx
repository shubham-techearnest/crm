import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RouterProvider } from "react-router-dom";
import {
  bindPendingCustomFields,
  commitPendingCustomFields,
  releasePendingCustomFields,
} from "@/features/customFields/customFieldCommit";
import { router } from "@/routes";

const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onMutate: (_variables, mutation) => bindPendingCustomFields(mutation.mutationId),
    onSuccess: (data, _variables, _context, mutation) =>
      commitPendingCustomFields(data, mutation.mutationId, queryClient),
    onError: (_error, _variables, _context, mutation) => releasePendingCustomFields(mutation.mutationId),
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children?: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children ?? <RouterProvider router={router} />}
    </QueryClientProvider>
  );
}

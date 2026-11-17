"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { qk } from "@/lib/api/query-keys";
import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  setCsrfToken,
} from "@/lib/api/client";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              if (
                error instanceof ApiError &&
                (error.code === "ABORTED" ||
                  error.code === "INVALID_RESPONSE" ||
                  (error.status >= 400 && error.status < 500))
              )
                return false;
              return count < 2;
            },
          },
        },
      }),
  );

  useEffect(() => {
    function clearSession(event: Event) {
      const scope = (event as CustomEvent<{ scope: string }>).detail?.scope;
      const key =
        scope === "workspace"
          ? qk.orgMe
          : scope === "admin"
            ? qk.adminMe
            : qk.me;
      setCsrfToken(null);
      void client.cancelQueries().then(() => {
        client.removeQueries({
          predicate: (query) =>
            JSON.stringify(query.queryKey) !== JSON.stringify(key),
        });
        client.getMutationCache().clear();
        client.setQueryData(key, null);
      });
    }
    const storage = (event: StorageEvent) => {
      if (event.key === "gatherly.workspace.logout")
        clearSession(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: { scope: "workspace" },
          }),
        );
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, clearSession);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, clearSession);
      window.removeEventListener("storage", storage);
    };
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

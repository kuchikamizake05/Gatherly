"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useMe } from "@/modules/auth/hooks";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useAdminMe } from "@/modules/admin/hooks";
import { QueryState } from "@/components/elements/QueryState";
import { Skeleton } from "@/components/ui/skeleton";

function GuardLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 md:px-8"
      aria-busy
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-80" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function useRedirect(when: boolean, to: string) {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace(to);
  }, [when, to, router]);
}

/** Halaman peserta yang butuh login (Tiketku, Disimpan, Akun saya, checkout). */
export function RequireBuyer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, isPending, isError, error, refetch } = useMe();
  useRedirect(
    !isPending && data === null,
    `/login?returnTo=${encodeURIComponent(pathname)}`,
  );
  if (isError) return <QueryState error={error} retry={refetch} />;
  if (isPending || !data) return <GuardLoading />;
  return <>{children}</>;
}

/**
 * Ruang kerja organizer.gatherly.xyz.
 * - Belum masuk → /login
 * - Masih password sementara → /change-password
 * - Panitia hanya boleh membuka daftar acara ditugaskan dan halaman scan.
 */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/^\/organizer/, "") || "/";
  const { data, isPending, isError, error, refetch } = useWorkspaceMe();
  const committeeAllowed =
    pathname === "/" || /^\/events\/[^/]+\/scan(\/.*)?$/.test(pathname);

  const target = isPending
    ? null
    : data === null
      ? `/login?returnTo=${encodeURIComponent(pathname)}`
      : data?.mustChangePassword
        ? "/change-password"
        : data?.role === "committee" && !committeeAllowed
          ? "/"
          : null;

  useRedirect(!!target, target ?? "/");
  if (isError) return <QueryState error={error} retry={refetch} />;
  if (isPending || !data || target) return <GuardLoading />;
  return <>{children}</>;
}

/** Konsol admin.gatherly.xyz. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/^\/admin/, "") || "/";
  const { data, isPending, isError, error, refetch } = useAdminMe();
  useRedirect(
    !isPending && data === null,
    `/login?returnTo=${encodeURIComponent(pathname)}`,
  );
  if (isError) return <QueryState error={error} retry={refetch} />;
  if (isPending || !data) return <GuardLoading />;
  return <>{children}</>;
}

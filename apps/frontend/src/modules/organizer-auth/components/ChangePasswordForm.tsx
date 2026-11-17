"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthHeading } from "@/modules/auth/components/AuthUi";
import { useChangeTemporaryPassword, useWorkspaceMe } from "../hooks";
import { QueryState } from "@/components/elements/QueryState";
import { PasswordForm } from "./PasswordForm";
export function ChangePasswordForm() {
  const change = useChangeTemporaryPassword();
  const me = useWorkspaceMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data === null) router.replace("/login");
    else if (me.data && !me.data.mustChangePassword) router.replace("/");
  }, [me.data, router]);
  if (me.isPending || me.isError)
    return (
      <QueryState loading={me.isPending} error={me.error} retry={me.refetch} />
    );
  if (!me.data?.mustChangePassword) return null;
  return (
    <div className="space-y-6">
      <AuthHeading title="Buat password Anda">
        Ganti password sementara sebelum membuka ruang kerja. Password sementara
        berlaku selama 7 hari.
      </AuthHeading>
      <PasswordForm
        pending={change.isPending}
        error={change.error}
        onSubmit={({ password }) =>
          change.mutate(password, { onSuccess: () => router.replace("/") })
        }
      />
    </div>
  );
}

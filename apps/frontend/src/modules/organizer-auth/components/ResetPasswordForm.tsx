"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthHeading } from "@/modules/auth/components/AuthUi";
import { Alert } from "@/components/elements/Alert";
import { useWorkspaceResetPassword } from "../hooks";
import { PasswordForm } from "./PasswordForm";
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const reset = useWorkspaceResetPassword();
  return (
    <div className="space-y-6">
      <AuthHeading title="Atur ulang password">
        Tautan reset berlaku selama 30 menit dan hanya dapat digunakan sekali.
      </AuthHeading>
      {!token ? (
        <Alert title="Tautan tidak valid">
          Minta tautan reset baru untuk melanjutkan.
        </Alert>
      ) : reset.isSuccess ? (
        <Alert tone="info" title="Password berhasil diubah">
          Silakan masuk dengan password baru Anda.
        </Alert>
      ) : (
        <PasswordForm
          pending={reset.isPending}
          error={reset.error}
          onSubmit={({ password }) => reset.mutate({ token, password })}
        />
      )}
      <Link
        href={token && reset.isSuccess ? "/login" : "/forgot-password"}
        className="block py-3 text-sm font-semibold underline"
      >
        {reset.isSuccess ? "Masuk" : "Minta tautan baru"}
      </Link>
    </div>
  );
}

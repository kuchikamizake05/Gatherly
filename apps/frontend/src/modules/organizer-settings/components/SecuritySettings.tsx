"use client";
import { useState } from "react";
import { Alert } from "@/components/elements/Alert";
import { PasswordForm } from "@/modules/organizer-auth/components/PasswordForm";
import { useChangeOrgPassword } from "../hooks";
export function SecuritySettings() {
  const change = useChangeOrgPassword();
  const [version, setVersion] = useState(0);
  return (
    <section className="space-y-6 rounded-lg bg-background p-4 md:p-6">
      <div>
        <h2 className="text-xl font-extrabold">Keamanan akun</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Gunakan password minimal 12 karakter yang berbeda dari password
          sebelumnya.
        </p>
      </div>
      {change.isSuccess && (
        <Alert tone="success" title="Password berhasil diubah">
          Gunakan password baru saat masuk kembali.
        </Alert>
      )}
      <div className="max-w-lg">
        <PasswordForm
          key={version}
          current
          pending={change.isPending}
          error={change.error}
          onSubmit={({ currentPassword, password }) =>
            change.mutate(
              { currentPassword, newPassword: password },
              { onSuccess: () => setVersion((v) => v + 1) },
            )
          }
        />
      </div>
    </section>
  );
}

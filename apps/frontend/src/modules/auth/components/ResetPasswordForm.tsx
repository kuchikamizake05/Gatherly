"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { useResetPassword } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/elements/Alert";
import { PasswordInput } from "@/components/elements/IconInput";
import { PASSWORD_MIN, PasswordRules } from "@/components/elements/PasswordStrength";
import { AuthActions, AuthHeading } from "./AuthUi";

/**
 * Buat password baru dari tautan email. Pita 11 baris A3, A4, B1, C2, C3.
 * URL: /reset-password?token=...&email=... (email opsional, hanya untuk ditampilkan).
 */

const schema = z
  .object({
    password: z.string().min(PASSWORD_MIN, `Password minimal ${PASSWORD_MIN} karakter`).max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Password belum sama dengan isian sebelumnya" });
type Values = z.infer<typeof schema>;

type Status = "form" | "done" | "invalid";

export function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const email = search.get("email");
  const online = useOnline();
  const reset = useResetPassword();
  const [status, setStatus] = useState<Status>(token ? "form" : "invalid");
  const [sameAsOld, setSameAsOld] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", defaultValues: { password: "", confirm: "" } });
  const password = watch("password");

  if (status === "done") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <AuthHeading title="Password diperbarui">
          Kami juga keluar dari semua perangkat lain demi keamanan. Masuk lagi dengan password baru.
        </AuthHeading>
        <AuthActions>
          <Button asChild size="lg" block>
            <Link href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"}>Masuk</Link>
          </Button>
        </AuthActions>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <AuthHeading title="Tautan sudah tidak berlaku">
          Tautan untuk membuat password baru hanya berlaku 30 menit dan satu kali pakai. Minta tautan baru untuk melanjutkan.
        </AuthHeading>
        <AuthActions>
          <Button asChild size="lg" block>
            <Link href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}>Kirim tautan baru</Link>
          </Button>
          <Button asChild size="lg" block variant="ghost">
            <Link href="/login">Kembali ke Masuk</Link>
          </Button>
        </AuthActions>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-5"
      onSubmit={handleSubmit((values) => {
        setSameAsOld(false);
        reset.mutate(
          { token, password: values.password },
          {
            onSuccess: () => setStatus("done"),
            onError: (e) => {
              const code = e instanceof ApiError ? e.code : "";
              if (code === "PASSWORD_REUSED") {
                setSameAsOld(true);
                setError("password", { message: "Gunakan password yang berbeda dari password lama" }, { shouldFocus: true });
              } else if (code === "TOKEN_INVALID" || code === "TOKEN_EXPIRED" || (e instanceof ApiError && e.status === 410)) {
                setStatus("invalid");
              } else setError("root", { message: "Terjadi kendala di server. Silakan coba lagi." });
            },
          },
        );
      })}
    >
      <AuthHeading title="Buat password baru">
        {email ? (
          <>
            Untuk akun <span className="font-semibold text-foreground">{email}</span>. Setelah ini Anda bisa langsung masuk.
          </>
        ) : (
          "Setelah ini Anda bisa langsung masuk."
        )}
      </AuthHeading>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Menyimpan password memerlukan koneksi internet.
        </Alert>
      )}
      {errors.root && <Alert title="Gagal menyimpan password">{errors.root.message}</Alert>}

      <Field label="Password baru" htmlFor="password" error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        <PasswordRules value={password} sameAsOld={sameAsOld} />
      </Field>

      <Field label="Ulangi password" htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>

      <AuthActions>
        <Button type="submit" size="lg" block loading={reset.isPending} disabled={!online}>
          {reset.isPending ? "Menyimpan…" : "Simpan password"}
        </Button>
      </AuthActions>
    </form>
  );
}

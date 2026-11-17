"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { AuthHeading } from "@/modules/auth/components/AuthUi";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceForgotPassword } from "../hooks";
export function ForgotPasswordForm() {
  const reset = useWorkspaceForgotPassword();
  const online = useOnline();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ identity: string }>({ mode: "onBlur" });
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(({ identity }) => reset.mutate(identity.trim()))}
    >
      <AuthHeading title="Lupa password?">
        Masukkan username atau email akun organizer Anda.
      </AuthHeading>
      {reset.data && (
        <Alert
          tone="info"
          title={
            reset.data.data.isCommittee
              ? "Hubungi organizer Anda"
              : "Periksa email Anda"
          }
        >
          {reset.data.data.isCommittee
            ? "Password panitia hanya dapat diatur ulang oleh organizer."
            : "Jika akun terdaftar, tautan pengaturan ulang akan dikirim ke email Anda dan berlaku selama 30 menit."}
        </Alert>
      )}
      {reset.error && (
        <Alert title="Permintaan belum terkirim">{reset.error.message}</Alert>
      )}
      <Field
        label="Username atau email"
        htmlFor="identity"
        error={errors.identity?.message}
      >
        <Input
          id="identity"
          autoComplete="username"
          {...register("identity", {
            required: "Username atau email wajib diisi",
            validate: (v) => !!v.trim() || "Username atau email wajib diisi",
          })}
        />
      </Field>
      <Button type="submit" disabled={!online || reset.isPending}>
        {reset.isPending ? "Mengirim…" : "Kirim tautan reset"}
      </Button>
      <Link
        href="/login"
        className="block py-3 text-sm font-semibold underline"
      >
        Kembali masuk
      </Link>
    </form>
  );
}

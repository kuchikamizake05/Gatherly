"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, User } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { authApi } from "@/modules/auth/api";
import { useRegister } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/elements/Alert";
import { IconInput, PasswordInput } from "@/components/elements/IconInput";
import { PASSWORD_MIN, PasswordLength } from "@/components/elements/PasswordStrength";
import { AuthActions, AuthHeading, GoogleButton, OrDivider, SwitchLink, useReturnTo, withReturnTo } from "./AuthUi";

/** Daftar akun peserta, lanjut ke kode OTP. Pita 10 baris A2, D, F. */

const schema = z.object({
  name: z.string().trim().min(2, "Nama lengkap wajib diisi"),
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email belum lengkap, contoh nama@email.com"),
  password: z.string().min(PASSWORD_MIN, `Password minimal ${PASSWORD_MIN} karakter`).max(128),
  agree: z.boolean().refine((v) => v, "Centang persetujuan untuk melanjutkan"),
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const returnTo = useReturnTo();
  const online = useOnline();
  const registerAccount = useRegister();
  const [generic, setGeneric] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", password: "", agree: false },
  });
  const password = watch("password");

  const onSubmit = handleSubmit((values) => {
    setGeneric(false);
    registerAccount.mutate(
      { name: values.name, email: values.email, password: values.password },
      {
        onSuccess: ({ data }) => {
          const params = new URLSearchParams({
            challengeId: data.challengeId,
            purpose: "register",
            email: values.email,
            resendAt: data.resendAt,
          });
          if (returnTo !== "/") params.set("returnTo", returnTo);
          router.push(`/verify?${params.toString()}`);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "EMAIL_ALREADY_EXISTS") {
            setError("email", { message: "Email ini sudah terdaftar." }, { shouldFocus: true });
          } else setGeneric(true);
        },
      },
    );
  });

  const emailExists = errors.email?.message === "Email ini sudah terdaftar.";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-5">
      <AuthHeading title="Buat akun">Satu akun untuk membeli tiket dan menyimpan acara favorit Anda.</AuthHeading>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Pendaftaran memerlukan koneksi internet. Periksa koneksi Anda.
        </Alert>
      )}
      {errors.agree && (
        <Alert title="Centang persetujuan untuk melanjutkan">
          Anda perlu menyetujui Syarat dan Ketentuan serta Kebijakan Privasi.
        </Alert>
      )}
      {generic && <Alert title="Gagal mendaftar">Terjadi kendala di server. Silakan coba lagi.</Alert>}

      <GoogleButton href={authApi.googleUrl(returnTo)} disabled={!online}>
        Daftar dengan Google
      </GoogleButton>
      <OrDivider />

      <Field label="Nama lengkap" htmlFor="name" error={errors.name?.message}>
        <IconInput id="name" autoComplete="name" leading={<User />} aria-invalid={!!errors.name} {...register("name")} />
      </Field>

      <Field
        label="Email"
        htmlFor="email"
        error={
          emailExists ? (
            <>
              Email ini sudah terdaftar.{" "}
              <Link href={withReturnTo(`/login?email=${encodeURIComponent(watch("email"))}`, returnTo)} className="font-bold underline">
                Silakan masuk.
              </Link>
            </>
          ) : (
            errors.email?.message
          )
        }
      >
        <IconInput
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          leading={<Mail />}
          placeholder="nama@email.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        {!errors.password && <PasswordLength value={password} />}
      </Field>

      <Controller
        control={control}
        name="agree"
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id="agree"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              aria-invalid={!!errors.agree}
              className={errors.agree ? "border-danger" : undefined}
            />
            <label htmlFor="agree" className="text-sm leading-relaxed text-text-secondary">
              Saya menyetujui{" "}
              <Link href="/#syarat" className="font-bold text-foreground underline-offset-4 hover:underline">
                Syarat dan Ketentuan
              </Link>{" "}
              serta{" "}
              <Link href="/#privasi" className="font-bold text-foreground underline-offset-4 hover:underline">
                Kebijakan Privasi
              </Link>{" "}
              Gatherly.
            </label>
          </div>
        )}
      />

      <AuthActions>
        <Button type="submit" size="lg" block loading={registerAccount.isPending} disabled={!online}>
          {registerAccount.isPending ? "Memproses…" : "Daftar"}
        </Button>
        <SwitchLink text="Sudah punya akun?" label="Masuk" href={withReturnTo("/login", returnTo)} />
      </AuthActions>
    </form>
  );
}

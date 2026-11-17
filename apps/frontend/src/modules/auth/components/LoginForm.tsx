"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { authApi } from "@/modules/auth/api";
import { useLogin } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/elements/Alert";
import { IconInput, PasswordInput } from "@/components/elements/IconInput";
import { AuthActions, AuthHeading, GoogleButton, OrDivider, SwitchLink, useReturnTo, withReturnTo } from "./AuthUi";

/** Masuk dengan email + password, lalu kode OTP. Pita 10 baris A, B, C, E, H. */

const schema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email belum lengkap, contoh nama@email.com"),
  password: z.string().min(1, "Password wajib diisi"),
});
type Values = z.infer<typeof schema>;

type FormError = "credentials" | "rate_limited" | "google" | "generic" | null;

type LoginFormProps = {
  /** Ganti judul bawaan, misalnya judul dialog "Masuk untuk melanjutkan" (pita 04 C2). */
  heading?: ReactNode;
  /** Tujuan setelah verifikasi. Bawaan dari ?returnTo di URL. */
  returnTo?: string;
  /** Dipakai di dalam dialog atau drawer: tombol tidak menempel di bawah layar. */
  embedded?: boolean;
};

export function LoginForm({ heading, returnTo: returnToProp, embedded = false }: LoginFormProps = {}) {
  const router = useRouter();
  const search = useSearchParams();
  const urlReturnTo = useReturnTo();
  const returnTo = returnToProp ?? urlReturnTo;
  const online = useOnline();
  const login = useLogin();
  const [formError, setFormError] = useState<FormError>(search.get("error") === "google" ? "google" : null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur", defaultValues: { email: search.get("email") ?? "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: ({ data }) => {
        const params = new URLSearchParams({
          challengeId: data.challengeId,
          purpose: "login",
          email: values.email,
          resendAt: data.resendAt,
        });
        if (returnTo !== "/") params.set("returnTo", returnTo);
        router.push(`/verify?${params.toString()}`);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) setFormError("credentials");
        else if (error instanceof ApiError && error.status === 429) setFormError("rate_limited");
        else setFormError("generic");
      },
    });
  });

  const locked = formError === "rate_limited";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-5">
      {heading ?? (
        <AuthHeading title="Masuk ke Gatherlyy">Selamat datang kembali. Masuk untuk melihat tiket dan melanjutkan pembelian.</AuthHeading>
      )}

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Masuk memerlukan koneksi internet. Periksa koneksi Anda.
        </Alert>
      )}
      {formError === "credentials" && (
        <Alert title="Email atau password tidak cocok">Periksa kembali isian Anda atau gunakan Lupa password.</Alert>
      )}
      {formError === "rate_limited" && (
        <Alert title="Terlalu banyak percobaan">Demi keamanan, coba lagi dalam 10 menit atau atur ulang password Anda.</Alert>
      )}
      {formError === "google" && (
        <Alert title="Gagal masuk dengan Google">Jendela Google ditutup atau koneksi terputus. Silakan coba lagi.</Alert>
      )}
      {formError === "generic" && <Alert title="Gagal masuk">Terjadi kendala di server. Silakan coba lagi.</Alert>}
      {search.get("reason") === "session" && !formError && (
        <Alert tone="warning" title="Sesi Anda telah berakhir">
          {returnTo.startsWith("/account") ? "Silakan masuk kembali untuk membuka Akun saya." : "Silakan masuk kembali untuk melanjutkan."}
        </Alert>
      )}

      <GoogleButton href={authApi.googleUrl(returnTo)} disabled={!online}>
        Masuk dengan Google
      </GoogleButton>
      <OrDivider />

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <IconInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          leading={<Mail />}
          placeholder="nama@email.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        labelAside={
          <Link href={withReturnTo("/forgot-password", returnTo)} className="text-[13px] font-bold underline-offset-4 [@media(hover:hover)]:hover:underline">
            Lupa password?
          </Link>
        }
      >
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>

      <AuthActions embedded={embedded}>
        <Button type="submit" size="lg" block loading={login.isPending} disabled={!online || locked}>
          {login.isPending ? "Memproses…" : "Masuk"}
        </Button>
        <p className={embedded ? "text-[13px] text-text-tertiary" : "hidden text-[13px] text-text-tertiary md:block"}>
          Kami akan mengirim kode 6 digit ke email untuk memastikan ini Anda.
        </p>
        <SwitchLink text="Belum punya akun?" label="Daftar" href={withReturnTo("/register", returnTo)} />
      </AuthActions>
    </form>
  );
}

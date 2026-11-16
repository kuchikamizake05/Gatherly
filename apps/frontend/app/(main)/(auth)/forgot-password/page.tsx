"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { useForgotPassword } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/elements/alert";
import { IconInput } from "@/components/elements/icon-input";
import { AuthActions, AuthHeading, BackLink, useReturnTo, withReturnTo } from "../_components/auth-ui";

/** Minta tautan password baru. Pita 11 baris A1, A2, C1, C4, D1. */

const schema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email belum lengkap, contoh nama@email.com"),
});

/** a••••@mail.ugm.ac.id */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return name && domain ? `${name[0]}••••@${domain}` : email;
}

function ForgotForm() {
  const search = useSearchParams();
  const returnTo = useReturnTo();
  const online = useOnline();
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: search.get("email") ?? "" },
  });

  const loginHref = withReturnTo("/login", returnTo);

  if (sentTo) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <AuthHeading title="Periksa email Anda">
          Jika <span className="font-semibold text-foreground">{maskEmail(sentTo)}</span> terdaftar, tautan untuk membuat password
          baru sudah dikirim. Tautan berlaku 30 menit.
        </AuthHeading>
        <AuthActions>
          <Button asChild size="lg" block variant="outline">
            <Link href={loginHref}>Kembali ke Masuk</Link>
          </Button>
        </AuthActions>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-5"
      onSubmit={handleSubmit(({ email }) => {
        setLimited(false);
        forgot.mutate(email, {
          onSuccess: () => setSentTo(email),
          onError: (e) => {
            if (e instanceof ApiError && e.status === 429) setLimited(true);
            // Selain batas permintaan, tetap tampilkan konfirmasi supaya tidak membocorkan email terdaftar.
            else setSentTo(email);
          },
        });
      })}
    >
      <BackLink href={loginHref}>Kembali ke Masuk</BackLink>
      <AuthHeading title="Lupa password">Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.</AuthHeading>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Pengiriman tautan memerlukan koneksi internet.
        </Alert>
      )}
      {limited && <Alert title="Terlalu banyak permintaan">Tunggu 10 menit sebelum meminta tautan baru.</Alert>}

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
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

      <AuthActions>
        <Button type="submit" size="lg" block loading={forgot.isPending} disabled={!online || limited}>
          {forgot.isPending ? "Mengirim…" : "Kirim tautan"}
        </Button>
      </AuthActions>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { OtpInput } from "@/components/elements/OtpInput";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";
import { useOnline } from "@/hooks/use-online";
import { ApiError } from "@/lib/api/client";
import { useAdminVerifyTotp, useAdminBackupCode } from "@/modules/admin/hooks";

export function AdminVerifyForm({ backup = false }: { backup?: boolean }) {
  const router = useRouter();
  const totp = useAdminVerifyTotp();
  const backupCode = useAdminBackupCode();
  const online = useOnline();
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const schema = z.object({
    code: backup
      ? z.string().trim().min(1, "Masukkan kode cadangan Anda.")
      : z.string().regex(/^\d{6}$/, "Masukkan kode 6 digit."),
    remember: z.boolean(),
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { code: "", remember: false },
  });
  const busy = totp.isPending || backupCode.isPending;
  const submit = handleSubmit(async (values) => {
    if (!online || busy) return;
    const challengeId = sessionStorage.getItem("gatherly_admin_challenge");
    if (!challengeId) {
      setExpired(true);
      return;
    }
    setError("");
    try {
      if (backup)
        await backupCode.mutateAsync({ challengeId, code: values.code });
      else
        await totp.mutateAsync({
          challengeId,
          code: values.code,
          rememberDevice: values.remember,
        });
      sessionStorage.removeItem("gatherly_admin_challenge");
      router.replace("/applications");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      const status = error instanceof ApiError ? error.status : 0;
      // Kode dari backend: CHALLENGE_INVALID dan CHALLENGE_USED berarti sesi verifikasi tidak berlaku lagi.
      if (["CHALLENGE_EXPIRED", "CHALLENGE_INVALID", "CHALLENGE_USED"].includes(code))
        setExpired(true);
      else if (code === "NETWORK_ERROR")
        setError("Koneksi terputus. Periksa internet Anda lalu coba lagi.");
      else if (code === "ACCOUNT_LOCKED" || status === 429)
        setError("Terlalu banyak percobaan. Akun dikunci sementara, coba lagi dalam 10 menit.");
      else if (status >= 500)
        setError("Server sedang bermasalah. Tunggu sebentar, lalu coba lagi dengan kode yang baru.");
      else {
        setError("Kode tidak sesuai. Periksa kode dan coba lagi.");
        setValue("code", "");
        setFocusKey((value) => value + 1);
      }
    }
  });
  if (!online || expired)
    return (
      <StateView
        illustration={expired ? "expired" : "failed-load"}
        title={expired ? "Sesi verifikasi berakhir" : "Anda sedang luring"}
        description={
          expired
            ? "Masuk kembali untuk memulai verifikasi."
            : "Periksa koneksi Anda untuk melanjutkan."
        }
        action={
          expired ? (
            <Button asChild>
              <Link href="/login">Kembali ke masuk</Link>
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold">
          {backup ? "Kode cadangan" : "Verifikasi dua langkah"}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {backup
            ? "Masukkan salah satu kode cadangan Anda. Setiap kode hanya bisa dipakai sekali."
            : "Masukkan kode 6 digit dari aplikasi autentikator."}
        </p>
      </div>
      {error && <Alert title={error} />}
      {backup ? (
        <Field
          label="Kode cadangan"
          htmlFor="backup-code"
          error={errors.code?.message}
        >
          <Input
            id="backup-code"
            autoComplete="off"
            aria-invalid={!!errors.code}
            {...register("code")}
          />
        </Field>
      ) : (
        <>
          <Field label="Kode autentikator" error={errors.code?.message}>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={field.onChange}
                  error={!!error || !!errors.code}
                  disabled={busy}
                  focusKey={focusKey}
                />
              )}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                  disabled={busy}
                />
              )}
            />
            Ingat perangkat ini selama 7 hari
          </label>
        </>
      )}
      <Button
        type="submit"
        loading={busy}
        disabled={backup ? !watch("code").trim() : watch("code").length !== 6}
        block
      >
        {busy ? "Memverifikasi…" : "Verifikasi"}
      </Button>
      <Link
        className="flex min-h-11 items-center text-sm font-bold underline"
        href={backup ? "/verify" : "/backup-code"}
      >
        {backup ? "Gunakan kode autentikator" : "Gunakan kode cadangan"}
      </Link>
      <Link
        className="flex min-h-11 items-center text-sm text-text-secondary"
        href="/login"
      >
        Kembali ke masuk
      </Link>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { useResendOtp, useVerifyLogin, useVerifyRegister } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { OtpInput } from "@/components/elements/OtpInput";
import { AuthActions, AuthHeading, BackLink, useReturnTo, withReturnTo } from "./AuthUi";

/**
 * Kode 6 digit dari email, untuk masuk (pita 10 B3) dan daftar (D2).
 * URL: /verify?challengeId=...&purpose=login|register&email=...&resendAt=...&returnTo=...
 * Kesalahan: pita 10 baris G.
 */

const MAX_ATTEMPTS = 5;
type CodeError = "invalid" | "expired" | "locked" | "generic" | null;

function useSecondsUntil(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
}

export function VerifyForm() {
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = useReturnTo();
  const online = useOnline();

  const [challengeId, setChallengeId] = useState(search.get("challengeId") ?? "");
  const purpose = search.get("purpose") === "register" ? "register" : "login";
  const email = search.get("email") ?? "email Anda";

  const [code, setCode] = useState("");
  const [error, setError] = useState<CodeError>(null);
  const [failures, setFailures] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [resendAt, setResendAt] = useState<string | null>(search.get("resendAt"));
  const resendIn = useSecondsUntil(resendAt);

  const verifyLogin = useVerifyLogin();
  const verifyRegister = useVerifyRegister();
  const verify = purpose === "register" ? verifyRegister : verifyLogin;
  const resend = useResendOtp();

  useEffect(() => {
    if (!challengeId) router.replace(withReturnTo(purpose === "register" ? "/register" : "/login", returnTo));
  }, [challengeId, purpose, returnTo, router]);

  const submit = (value = code) => {
    if (value.length !== 6 || verify.isPending) return;
    setError(null);
    verify.mutate(
      { challengeId, code: value },
      {
        onSuccess: ({ data }) => {
          const firstName = data.user.name.split(" ")[0];
          toast.success(purpose === "register" ? "Akun Anda sudah aktif" : `Anda sudah masuk sebagai ${firstName}`);
          router.replace(returnTo);
        },
        onError: (e) => {
          const codeName = e instanceof ApiError ? e.code : "";
          if (codeName === "OTP_INVALID") {
            setFailures((n) => n + 1);
            setError("invalid");
          } else if (codeName === "OTP_EXPIRED") setError("expired");
          else if (codeName === "OTP_LOCKED") setError("locked");
          else setError("generic");
          setCode("");
          setFocusKey((k) => k + 1);
        },
      },
    );
  };

  const onResend = () => {
    resend.mutate(challengeId, {
      onSuccess: ({ data }) => {
        setChallengeId(data.challengeId || challengeId);
        setResendAt(data.resendAt);
        setError(null);
        setFailures(0);
        setCode("");
        setFocusKey((k) => k + 1);
        toast.success("Kode baru sudah dikirim");
      },
      onError: () => toast.error("Gagal mengirim kode. Coba lagi sebentar lagi."),
    });
  };

  const remaining = Math.max(0, MAX_ATTEMPTS - failures);

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <BackLink href={withReturnTo(purpose === "register" ? "/register" : "/login", returnTo)}>
        {purpose === "register" ? "Ganti email" : "Kembali ke Masuk"}
      </BackLink>
      <AuthHeading title="Periksa email Anda">
        Kami mengirim kode 6 digit ke <span className="font-semibold text-foreground">{email}</span>. Kode berlaku 10 menit.
      </AuthHeading>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Verifikasi memerlukan koneksi internet. Periksa koneksi Anda.
        </Alert>
      )}
      {error === "invalid" && (
        <Alert title="Kode salah">Sisa {remaining} percobaan. Periksa kembali kode di email Anda.</Alert>
      )}
      {error === "expired" && (
        <Alert tone="warning" title="Kode sudah kedaluwarsa">
          Kirim kode baru untuk melanjutkan.
        </Alert>
      )}
      {error === "locked" && <Alert title="Terlalu banyak percobaan">Kirim kode baru untuk melanjutkan.</Alert>}
      {error === "generic" && <Alert title="Gagal memverifikasi">Terjadi kendala di server. Silakan coba lagi.</Alert>}

      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error === "invalid") setError(null);
        }}
        onComplete={submit}
        error={error === "invalid"}
        disabled={verify.isPending || error === "expired" || error === "locked"}
        focusKey={focusKey}
      />

      <p className="text-[13px] text-text-tertiary">
        Belum menerima email? Periksa folder spam.{" "}
        {resendIn > 0 ? (
          <span>
            Kirim ulang dalam <span className="font-bold text-text-secondary tabular-nums">{resendIn} detik</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending || !online}
            className="font-bold text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            {resend.isPending ? "Mengirim…" : "Kirim ulang kode"}
          </button>
        )}
      </p>

      <AuthActions>
        <Button type="submit" size="lg" block loading={verify.isPending} disabled={!online || code.length !== 6}>
          {verify.isPending ? "Memverifikasi…" : "Verifikasi"}
        </Button>
      </AuthActions>
    </form>
  );
}

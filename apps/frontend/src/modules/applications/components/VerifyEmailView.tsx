"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { applicationsApi } from "@/modules/applications/api";
import { StateView } from "@/components/elements/StateView";
import { Button } from "@/components/ui/button";

/**
 * Tujuan tautan verifikasi di email penanggung jawab. Dulu tautan mengarah langsung ke API dan
 * menampilkan JSON; sekarang halaman ini memanggil API lalu menampilkan hasilnya.
 * Token hanya berlaku sekali, jadi permintaan tidak diulang otomatis.
 */
export function VerifyEmailView() {
  const token = useSearchParams().get("token") ?? "";
  const verify = useQuery({
    queryKey: ["application-verify-email", token],
    queryFn: async () => (await applicationsApi.verifyEmail(token)).data,
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (token.length < 20)
    return (
      <StateView
        illustration="not-found"
        title="Tautan verifikasi tidak lengkap"
        description="Buka tautan langsung dari email Gatherlyy, atau salin seluruh alamatnya ke browser."
        action={
          <Button asChild variant="outline">
            <Link href="/become-organizer">Ke halaman pengajuan</Link>
          </Button>
        }
      />
    );

  if (verify.isPending)
    return (
      <StateView
        illustration="verifying"
        title="Memverifikasi email"
        description="Mohon tunggu sebentar."
      />
    );

  if (verify.isError)
    return (
      <StateView
        illustration="expired"
        tone="error"
        title="Tautan verifikasi tidak berlaku"
        description="Tautan sudah dipakai atau sudah lewat 24 jam. Bila email Anda sudah terverifikasi, tidak perlu melakukan apa pun. Bila belum, ajukan ulang atau hubungi tim Gatherlyy."
        action={
          <Button asChild variant="outline">
            <Link href="/become-organizer">Ke halaman pengajuan</Link>
          </Button>
        }
      />
    );

  return (
    <StateView
      illustration="success"
      title="Email berhasil diverifikasi"
      description={
        <>
          Pengajuan <strong className="text-foreground">{verify.data.number}</strong> sekarang
          masuk antrean peninjauan. Tim Gatherlyy akan mengirim hasilnya ke email ini paling lambat
          3 hari kerja.
        </>
      }
      action={
        <Button asChild>
          <Link href="/">Kembali ke beranda</Link>
        </Button>
      }
    />
  );
}

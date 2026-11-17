"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Download, MapPin, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { ApiError } from "@/lib/api/client";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useSharedTicket } from "@/modules/tickets/hooks";
import { mapsUrl } from "@/modules/tickets/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";
import { useAutoPrint } from "@/components/elements/PrintPage";
import { CalendarMenu } from "./CalendarMenu";
import { ETicketCard } from "./ETicketCard";
import { TicketSheets } from "./TicketPrintView";

/**
 * Tiket yang dibagikan, dibuka dari tautan di email e-tiket tiap peserta, tanpa login. Pita 06 baris I.
 * Hanya tiket milik penerima: tanpa pemilih peserta, data pesanan, atau kirim ulang.
 */
export function SharedTicketView({ token }: { token: string }) {
  const online = useOnline();
  const query = useSharedTicket(token);

  if (query.isPending) return <SharedTicketSkeleton />;
  if (query.isError) {
    const invalid = query.error instanceof ApiError && query.error.status === 404;
    return (
      <StateView
        illustration={invalid ? "not-found" : "failed-load"}
        tone={invalid ? "neutral" : "error"}
        title={invalid ? "Tautan e-tiket tidak berlaku" : "E-tiket gagal dimuat"}
        description={
          invalid
            ? "Tautan ini salah atau sudah tidak dipakai. Buka email e-tiket terbaru, atau minta pemesan mengirim ulang e-tiket dari Tiketku."
            : "Periksa koneksi internet Anda, lalu coba lagi."
        }
        action={
          invalid ? (
            <Button asChild>
              <Link href="/">Jelajahi acara</Link>
            </Button>
          ) : (
            <Button onClick={() => void query.refetch()}>Coba lagi</Button>
          )
        }
      />
    );
  }

  const ticket = query.data;
  const event = ticket.event;
  const cancelled = event.status === "cancelled";
  const doors = event.doorsOpenAt ? formatTime(event.doorsOpenAt) : null;
  const subtitle = `${format(new Date(event.startsAt), "EEE, d MMM yyyy", { locale: localeId })}, ${formatTime(event.startsAt)}, ${event.venueName}${event.city ? `, ${event.city}` : ""}`;

  const download = () => {
    window.open(`/tickets/shared/${encodeURIComponent(token)}/print`, "_blank", "noopener");
    toast("PDF e-tiket sedang diunduh", { icon: <Download className="size-[18px]" /> });
  };

  const actions = (
    <>
      <CalendarMenu event={event} orderId={ticket.id}>
        <Button variant="outline" size="sm" className="flex-1 md:flex-none">
          <CalendarPlus className="size-4" aria-hidden />
          <span className="md:hidden">Kalender</span>
          <span className="hidden md:inline">Tambah ke kalender</span>
        </Button>
      </CalendarMenu>
      <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={download}>
        <Download className="size-4" aria-hidden />
        <span className="md:hidden">Unduh</span>
        <span className="hidden md:inline">Unduh e-tiket (PDF)</span>
      </Button>
      <Button asChild variant="outline" size="sm" className="flex-1 md:flex-none">
        <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer">
          <MapPin className="size-4" aria-hidden />
          <span className="md:hidden">Peta</span>
          <span className="hidden md:inline">Buka di Google Maps</span>
        </a>
      </Button>
    </>
  );

  const notices = (
    <>
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          E-tiket tetap dapat ditunjukkan karena tersimpan di perangkat ini.
        </Alert>
      )}
      {cancelled && <Alert title="Acara ini dibatalkan penyelenggara">E-tiket tidak berlaku. Informasi pengembalian dana dikirim ke pemesan.</Alert>}
    </>
  );

  const tips = [
    "Tunjukkan kode QR dari ponsel, tidak perlu dicetak.",
    "Satu kode QR untuk satu orang. Panitia memindai satu kali.",
    "Jangan bagikan tangkapan layar kode QR kepada orang lain.",
    ...(event.minAge ? [`Bawa kartu identitas, acara ini khusus ${event.minAge} tahun ke atas.`] : []),
    ...(doors ? [`Pintu dibuka ${doors}.`] : []),
  ];

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Header mobile: logo ke beranda, karena penerima tautan belum tentu punya akun. */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-background px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 md:hidden">
        <Link href="/" aria-label="Gatherlyy, ke beranda" className="press flex size-11 items-center">
          <Image src="/gatherly-symbol-ink.svg" alt="" width={28} height={28} priority />
        </Link>
        <span className="text-[17px] font-extrabold">E-tiket</span>
        <span className="size-11" aria-hidden />
      </div>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-[15px] pt-2 pb-16 md:gap-8 md:px-6 md:pt-10 md:pb-24 xl:px-0">
        <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight">{event.title}</h1>
            <p className="text-[15px] text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <h1 className="sr-only md:hidden">{`E-tiket ${event.title}`}</h1>

        <div className="flex flex-col gap-4 md:hidden">{notices}</div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,668px)_420px] xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="hidden flex-col gap-4 md:flex">{notices}</div>
            <div className="flex justify-center">
              <ETicketCard ticket={ticket} className="mx-auto md:max-w-[560px] xl:max-w-none" />
            </div>
            <div className="flex gap-2 md:hidden">{actions}</div>
            <p className="flex items-start gap-2 text-[13px] text-text-tertiary">
              <UserRound className="mt-px size-4 shrink-0" aria-hidden />
              Tiket atas nama {ticket.attendeeName}. Tunjukkan kode QR ini saat masuk, tidak perlu akun Gatherlyy.
            </p>
            <p className="flex gap-2.5 rounded-md bg-surface px-3.5 py-3 text-[13px] text-text-secondary md:hidden">
              <Sun className="mt-px size-4 shrink-0" aria-hidden />
              Naikkan kecerahan layar saat QR dipindai.{doors ? ` Pintu dibuka pada ${doors}.` : ""}
            </p>
          </div>

          <aside className="hidden flex-col gap-3.5 self-start rounded-lg border border-border-strong p-6 md:flex">
            <h2 className="text-[17px] font-extrabold">Saat datang</h2>
            <ul className="flex flex-col gap-2.5">
              {tips.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-[15px] leading-relaxed text-text-secondary">
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** PDF tiket yang dibagikan. Halaman cetak tanpa login. */
export function SharedTicketPrintView({ token }: { token: string }) {
  const query = useSharedTicket(token);
  useAutoPrint(query.isSuccess);
  if (query.isError)
    return (
      <StateView
        layout="screen"
        tone="error"
        illustration="not-found"
        title="E-tiket tidak dapat diunduh"
        description="Tautan ini salah atau sudah tidak dipakai. Buka lagi tautan dari email e-tiket."
      />
    );
  if (!query.isSuccess) return <div className="min-h-dvh bg-surface-2" aria-busy />;
  return <TicketSheets tickets={[query.data]} />;
}

function SharedTicketSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-[15px] pt-14 md:px-6 md:pt-10 xl:px-0" aria-busy>
      <span className="skeleton hidden h-10 w-96 rounded md:block" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,668px)_420px] xl:justify-between">
        <span className="skeleton mx-auto h-[558px] w-full max-w-[400px] rounded-xl xl:mx-0" />
        <span className="skeleton hidden h-[260px] rounded-lg md:block" />
      </div>
    </div>
  );
}

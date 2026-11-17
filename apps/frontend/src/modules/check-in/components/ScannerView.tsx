"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  History,
  Search,
  Volume2,
  VolumeX,
  X,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { QueryState } from "@/components/elements/QueryState";
import { StateView } from "@/components/elements/StateView";
import { useOnline } from "@/hooks/use-online";
import { useDebounced } from "@/hooks/use-debounced";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import {
  useAssignedEvents,
  useCheckIn,
  useScanHistory,
  useTicketLookup,
} from "../hooks";
import { type LookupTicket } from "../api";
import { scanError, type ScanFeedback } from "../result";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";

function sound(valid: boolean) {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = valid ? 880 : 330;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);
    oscillator.onended = () => void audio.close();
  } catch {}
}
/** Penyebab kamera gagal menyala. qr-scanner meneruskan error getUserMedia, atau teks "Camera not found." */
function cameraProblem(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const text = String(error instanceof Error ? error.message : error);
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "insecure" as const;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "denied" as const;
  if (name === "NotReadableError" || name === "AbortError")
    return "busy" as const;
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    /not found/i.test(text)
  )
    return "missing" as const;
  return "denied" as const;
}

const CAMERA_COPY = {
  loading: {
    title: "Mengaktifkan kamera…",
    body: "Izinkan kamera untuk mulai memindai tiket.",
  },
  ready: { title: "", body: "" },
  denied: {
    title: "Akses kamera ditolak",
    body: "Browser tidak lagi menampilkan permintaan izin setelah ditolak. Klik ikon gembok di kolom alamat, izinkan Kamera, lalu coba lagi. Anda juga bisa memakai pencarian manual.",
  },
  missing: {
    title: "Kamera tidak ditemukan",
    body: "Perangkat ini tidak memiliki kamera yang bisa dipakai. Gunakan HP untuk memindai, atau pakai pencarian manual.",
  },
  busy: {
    title: "Kamera sedang dipakai",
    body: "Tutup aplikasi lain yang memakai kamera (misalnya Zoom atau Meet), lalu coba lagi.",
  },
  insecure: {
    title: "Kamera tidak tersedia di alamat ini",
    body: "Kamera hanya bisa dipakai di alamat https. Buka halaman ini lewat alamat resmi Gatherlyy.",
  },
} as const;

export function ScannerView({ eventId }: { eventId: string }) {
  const me = useWorkspaceMe();
  const account = me.data?.username ?? "";
  const online = useOnline();
  const assigned = useAssignedEvents();
  const history = useScanHistory(eventId);
  const accessRevoked = Boolean(
    history.error &&
    [401, 403].includes((history.error as { status?: number }).status ?? 0),
  );
  const checkIn = useCheckIn(eventId);
  const event = assigned.data?.data.find((event) => event.id === eventId);
  const video = useRef<HTMLVideoElement>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const [camera, setCamera] = useState<
    "loading" | "ready" | "denied" | "missing" | "busy" | "insecure"
  >("loading");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [muted, setMuted] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDebounced(query);
  const lookup = useTicketLookup(eventId, deferredQuery);
  const [confirm, setConfirm] = useState<LookupTicket | null>(null);
  const [processing, setProcessing] = useState(false);
  const result = useCallback(
    (value: ScanFeedback) => {
      if (!mounted.current) return;
      locked.current = true;
      setFeedback(value);
      if (!muted) sound(value.kind === "valid");
      navigator.vibrate?.(value.kind === "valid" ? [80] : [80, 70, 80]);
    },
    [muted],
  );
  const reset = () => {
    locked.current = false;
    setFeedback(null);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!feedback || feedback.kind === "forbidden") return;
    const timeout = setTimeout(reset, 3000);
    return () => clearTimeout(timeout);
  }, [feedback]);
  const submitRef = useRef<
    (input: { qrPayload: string } | { ticketCode: string }) => Promise<void>
  >(async () => {});
  async function submit(input: { qrPayload: string } | { ticketCode: string }) {
    if (locked.current || processing) return;
    locked.current = true;
    setProcessing(true);
    try {
      const mockQr =
        "qrPayload" in input &&
        process.env.NEXT_PUBLIC_API_MOCK === "true" &&
        /^gatherly:v1:mock-GTH-/.test(input.qrPayload);
      if (
        "qrPayload" in input &&
        !mockQr &&
        !/^gatherly:v1:[A-Za-z0-9_-]{43}$/.test(input.qrPayload)
      ) {
        result(scanError({ code: "INVALID_TICKET" }));
        return;
      }
      if (!online) {
        // Check-in wajib online. Tanpa koneksi, status tiket tidak bisa dipastikan.
        result(scanError({ code: "NETWORK_ERROR" }));
        return;
      } else {
        const response = await checkIn.mutateAsync(input);
        result({
          kind: "valid",
          title: "Tiket valid",
          description: `${response.data.ticketTypeName}, masuk ${formatTime(response.data.checkedInAt)}`,
          attendee: response.data.attendeeName,
        });
      }
      setManual(false);
      setConfirm(null);
    } catch (error) {
      setManual(false);
      setConfirm(null);
      result(
        scanError(
          error as { code?: string; details?: Record<string, unknown> },
        ),
      );
    } finally {
      setProcessing(false);
    }
  }
  submitRef.current = submit;
  useEffect(() => {
    if (accessRevoked || !video.current) return;
    let stopped = false;
    let scanner: { destroy: () => void } | undefined;
    setCamera("loading");
    void import("qr-scanner")
      .then(async ({ default: QrScanner }) => {
        if (stopped || !video.current) return;
        const camera = new QrScanner(
          video.current,
          (code) => {
            if (!locked.current)
              void submitRef.current({ qrPayload: code.data });
          },
          {
            returnDetailedScanResult: true,
            preferredCamera: "environment",
            maxScansPerSecond: 5,
          },
        );
        scanner = camera;
        try {
          await camera.start();
          if (stopped) camera.destroy();
          else setCamera("ready");
        } catch (error) {
          if (!stopped) setCamera(cameraProblem(error));
        }
      })
      .catch((error) => {
        if (!stopped) setCamera(cameraProblem(error));
      });
    return () => {
      stopped = true;
      scanner?.destroy();
    };
  }, [cameraAttempt, accessRevoked]);
  if (accessRevoked)
    return (
      <StateView
        illustration="failed-load"
        title="Akses pemindaian dicabut"
        description="Organizer mencabut penugasan Anda untuk acara ini."
        action={
          <Button asChild>
            <Link href="/">Kembali ke daftar acara</Link>
          </Button>
        }
      />
    );
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-inverse text-inverse-foreground xl:static xl:z-auto xl:flex-1 xl:bg-surface xl:p-8 xl:text-foreground">
      <header className="flex items-start justify-between gap-4 p-4 xl:px-0 xl:pt-0">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="bg-background text-foreground"
          >
            <Link href="/" aria-label="Kembali ke daftar acara">
              <X className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-extrabold xl:text-3xl">Scan tiket</h1>
            <p className="mt-1 text-sm opacity-80">
              {event?.title ?? "Pemindai acara"}
            </p>
          </div>
        </div>
        <Badge tone="brand" aria-live="polite">
          {history.data
            ? `${history.data.meta.total} / ${history.data.meta.paidTickets}`
            : "Memuat hitungan"}
        </Badge>
      </header>
      <div className="flex flex-1 flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-64 flex-1 overflow-hidden xl:aspect-video xl:min-h-96 xl:rounded-lg">
          <video
            ref={video}
            muted
            playsInline
            aria-label="Pratinjau kamera pemindai"
            className="absolute inset-0 size-full object-cover"
          />
          {camera !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-inverse p-6 text-center text-inverse-foreground">
              {camera === "loading" ? (
                <Camera className="size-6" />
              ) : (
                <CameraOff className="size-6" />
              )}
              <h2 className="text-lg font-bold">{CAMERA_COPY[camera].title}</h2>
              <p className="max-w-sm text-sm leading-relaxed">
                {CAMERA_COPY[camera].body}
              </p>
              {camera !== "loading" && (
                <Button
                  variant="outline"
                  onClick={() => setCameraAttempt((value) => value + 1)}
                >
                  Coba kamera lagi
                </Button>
              )}
            </div>
          )}
          {camera === "ready" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "aspect-square w-3/5 max-w-64 rounded-lg border-2 border-primary",
                  processing && "border-success",
                )}
              />
            </div>
          )}
          {processing && (
            <p
              role="status"
              className="absolute inset-x-4 bottom-4 rounded-md bg-inverse p-3 text-center text-sm text-inverse-foreground"
            >
              Kode QR terdeteksi, memeriksa tiket…
            </p>
          )}
        </div>
        <aside className="flex flex-col gap-4 rounded-t-xl bg-background p-4 text-foreground xl:rounded-lg xl:p-5">
          {!online && (
            <div
              role="status"
              className="rounded-md bg-warning-tint p-3 text-sm text-warning-ink"
            >
              <WifiOff className="mr-2 inline size-4" aria-hidden />
              Anda sedang luring. Pemindaian dihentikan sampai koneksi kembali,
              karena status tiket hanya bisa dipastikan secara online.
            </div>
          )}
          {feedback ? (
            <div
              role="status"
              aria-live="assertive"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg p-5 text-center",
                feedback.kind === "valid"
                  ? "bg-success-tint text-success-ink"
                  : ["network", "used", "closed"].includes(feedback.kind)
                    ? "bg-warning-tint text-warning-ink"
                    : "bg-danger-tint text-danger-ink",
              )}
            >
              {feedback.kind === "valid" ? (
                <Check className="size-6" />
              ) : (
                <CircleAlert className="size-6" />
              )}
              <h2 className="text-xl font-extrabold">{feedback.title}</h2>
              {feedback.attendee && (
                <p className="font-semibold">{feedback.attendee}</p>
              )}
              <p className="text-sm leading-relaxed">{feedback.description}</p>
              <Button className="mt-2 w-full" onClick={reset}>
                Pindai berikutnya
              </Button>
            </div>
          ) : (
            <div className="hidden rounded-lg bg-surface p-5 xl:block">
              <h2 className="font-bold">Menunggu kode QR</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Hasil pemindaian tampil di sini.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={processing}
              onClick={() => {
                reset();
                setConfirm(null);
                setManual(true);
              }}
            >
              <Search className="size-4" />
              Cari manual
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href={`/events/${eventId}/scan/history`}>
                <History className="size-4" />
                Riwayat
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={muted ? "Aktifkan suara" : "Matikan suara"}
              onClick={() => setMuted(!muted)}
            >
              {muted ? (
                <VolumeX className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </Button>
          </div>
          <div className="hidden space-y-3 xl:block">
            <h2 className="font-bold">Riwayat terakhir</h2>
            {history.data?.data.slice(0, 4).map((item, index) => (
              <div
                key={`${item.ticketId}-${index}`}
                className="flex justify-between gap-2 border-b border-border pb-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.attendeeName}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.reason ?? item.ticketTypeName}
                  </p>
                </div>
                <span className="text-xs text-text-secondary">
                  {formatTime(item.checkedInAt)}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <ResponsiveDialog
        open={manual}
        onOpenChange={(value) => {
          if (!processing) {
            setManual(value);
            setConfirm(null);
          }
        }}
        title={confirm ? `Tandai ${confirm.attendeeName} masuk?` : "Cari tiket"}
        description={
          confirm
            ? "Pastikan identitas peserta sesuai dengan nama pada tiket."
            : "Cari nama peserta atau kode tiket."
        }
      >
        {confirm ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {confirm.ticketTypeName}, {confirm.ticketCode}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Batal
              </Button>
              <Button
                loading={processing}
                onClick={() => {
                  reset();
                  void submit({ ticketCode: confirm.ticketCode });
                }}
              >
                Tandai masuk
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label htmlFor="ticket-query" className="text-sm font-bold">
              Nama atau kode tiket
            </label>
            <Input
              id="ticket-query"
              autoFocus
              placeholder="Contoh Rafi atau GTH-4A7N-31PL"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {deferredQuery.trim().length < 2 ? (
              <p className="text-sm text-text-secondary">
                Ketik minimal 2 karakter untuk mencari.
              </p>
            ) : lookup.isPending || lookup.isError ? (
              <QueryState
                loading={lookup.isPending}
                error={lookup.error}
                retry={lookup.refetch}
              />
            ) : !lookup.data?.data.length ? (
              <StateView
                layout="section"
                illustration="no-results"
                title="Tidak ada tiket yang cocok"
                description="Periksa ejaan nama atau gunakan kode tiket."
              />
            ) : (
              <div className="max-h-80 divide-y divide-border overflow-y-auto">
                {lookup.data.data.map((ticket) => (
                  <div
                    key={ticket.ticketId}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-bold">{ticket.attendeeName}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {ticket.ticketTypeName}, {ticket.ticketCode}
                      </p>
                    </div>
                    {ticket.checkInStatus === "unused" ? (
                      <Button
                        variant="outline"
                        onClick={() => setConfirm(ticket)}
                      >
                        Tandai masuk
                      </Button>
                    ) : (
                      <Badge
                        tone={
                          ticket.checkInStatus === "used" ? "success" : "danger"
                        }
                      >
                        {ticket.checkInStatus === "used"
                          ? "Sudah masuk"
                          : "Dibatalkan"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </ResponsiveDialog>
    </div>
  );
}

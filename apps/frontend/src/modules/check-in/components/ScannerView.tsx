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
import { toast } from "sonner";
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
import { checkInApi, type LookupTicket } from "../api";
import { scanError, type ScanFeedback } from "../result";
import {
  loadQueue,
  saveQueue,
  loadBundle,
  saveBundle,
  resolveOffline,
  type OfflineBundle,
  type OfflineEntry,
} from "../offline";
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
  const [camera, setCamera] = useState<"loading" | "ready" | "denied">(
    "loading",
  );
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [muted, setMuted] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDebounced(query);
  const lookup = useTicketLookup(eventId, deferredQuery);
  const [confirm, setConfirm] = useState<LookupTicket | null>(null);
  const [queue, setQueue] = useState<OfflineEntry[]>([]);
  const [queueReady, setQueueReady] = useState(false);
  const bundle = useRef<OfflineBundle | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [syncError, setSyncError] = useState("");
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
  useEffect(() => {
    if (!account) return;
    let stopped = false;
    void Promise.all([
      loadQueue(account, eventId),
      loadBundle(account, eventId),
    ])
      .then(([entries, cached]) => {
        if (!stopped) {
          setQueue(entries);
          bundle.current = cached;
          setQueueReady(true);
        }
      })
      .catch(() => {
        if (!stopped) {
          setQueueReady(true);
          setSyncError(
            "Penyimpanan luring tidak tersedia. Gunakan pemindai dengan koneksi internet.",
          );
        }
      });
    if (online)
      void checkInApi
        .offlineBundle(eventId)
        .then((response) => {
          if (!stopped && response.data.expiresAt) {
            bundle.current = response.data;
            void saveBundle(account, eventId, response.data).catch(() => {});
          }
        })
        .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [account, eventId, online]);
  useEffect(() => {
    if (
      !online ||
      !account ||
      !queueReady ||
      !queue.length ||
      syncingRef.current ||
      syncError
    )
      return;
    syncingRef.current = true;
    setSyncing(true);
    void (async () => {
      let remaining = [...queue];
      try {
        for (const entry of queue) {
          if (!mounted.current) return;
          try {
            await checkInApi.checkIn(eventId, { ticketCode: entry.ticketCode });
          } catch (error) {
            const failure = scanError(error as { code?: string });
            if (failure.kind !== "used") throw error;
            toast.warning(
              "Satu tiket luring sudah digunakan. Periksa riwayat bersama organizer.",
            );
          }
          remaining = remaining.filter((item) => item.id !== entry.id);
          await saveQueue(account, eventId, remaining);
          if (mounted.current) setQueue(remaining);
        }
        void history.refetch();
      } catch {
        if (mounted.current)
          setSyncError(
            "Sebagian check-in luring belum tersinkron. Periksa koneksi dan akses Anda, lalu coba lagi.",
          );
      } finally {
        syncingRef.current = false;
        if (mounted.current) setSyncing(false);
      }
    })();
  }, [online, account, queueReady, queue, eventId, syncError]);
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
        const ticket = await resolveOffline(
          bundle.current,
          input,
          queue,
          Date.now(),
        );
        const entries = [
          ...queue,
          {
            id: crypto.randomUUID(),
            ticketCode: ticket.ticketCode,
            scannedAt: new Date().toISOString(),
          },
        ];
        await saveQueue(account, eventId, entries);
        setQueue(entries);
        result({
          kind: "queued",
          title: "Tercatat di perangkat",
          description:
            "Belum dikonfirmasi server. Data dikirim saat koneksi kembali.",
          attendee: ticket.attendeeName,
        });
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
        } catch {
          if (!stopped) setCamera("denied");
        }
      })
      .catch(() => {
        if (!stopped) setCamera("denied");
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
              <h2 className="text-lg font-bold">
                {camera === "loading"
                  ? "Mengaktifkan kamera…"
                  : "Akses kamera belum diizinkan"}
              </h2>
              <p className="max-w-sm text-sm leading-relaxed">
                {camera === "loading"
                  ? "Izinkan kamera untuk mulai memindai tiket."
                  : "Izinkan kamera di pengaturan browser, atau gunakan pencarian manual."}
              </p>
              {camera === "denied" && (
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
              <WifiOff className="mr-2 inline size-4" />
              Mode luring.{" "}
              {bundle.current?.tickets.length
                ? `${queue.length} check-in menunggu sinkronisasi.`
                : "Daftar tiket luring belum tersedia. Status tiket perlu diperiksa saat koneksi kembali."}
            </div>
          )}
          {(queue.length > 0 || syncError) && (
            <div className="space-y-2 rounded-md bg-warning-tint p-3 text-sm text-warning-ink">
              <p>
                {syncError ||
                  `${queue.length} check-in ${syncing ? "sedang dikirim" : "menunggu sinkronisasi"}.`}
              </p>
              {syncError && (
                <Button variant="outline" onClick={() => setSyncError("")}>
                  Coba sinkronisasi lagi
                </Button>
              )}
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
                  : ["queued", "network", "used", "closed"].includes(
                        feedback.kind,
                      )
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

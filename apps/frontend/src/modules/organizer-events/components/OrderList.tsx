"use client";
import { Search } from "lucide-react";
import { IconInput } from "@/components/elements/IconInput";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { QueryState } from "@/components/elements/QueryState";
import { DataList } from "@/components/elements/DataList";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Alert } from "@/components/elements/Alert";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useDebounced } from "@/hooks/use-debounced";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { formatRupiah, formatDateTimeCompact } from "@/lib/format";
import { useOrgEventOrders, useOrgEventOrder, useRefundOrder } from "../hooks";
import { paymentMethod } from "@/modules/orders/payment-methods";
import { organizerEventsApi } from "../api";
import { downloadCsv } from "../csv";
import { ListPagination } from "./ListPagination";
import type { OrgOrderRow } from "../types";

export const paymentLabels: Record<OrgOrderRow["paymentStatus"], string> = {
  paid: "Lunas",
  pending: "Menunggu pembayaran",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
  partially_refunded: "Dikembalikan sebagian",
};
export function OrderList() {
  const { id } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [tickets, setTickets] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const orders = useOrgEventOrders(id, { q, paymentStatus: status, page });
  const order = useOrgEventOrder(id, selected);
  const refund = useRefundOrder(id);
  const online = useOnline();
  const me = useWorkspaceMe();
  const desktop = useIsDesktop();
  const disabled = !online || !!me.data?.organizer.frozen;
  const remaining =
    order.data?.tickets.filter((t) => t.checkInStatus !== "cancelled") ?? [];
  const refundAmount =
    (mode === "full" ? remaining.length : tickets.length) *
    (order.data?.unitPrice ?? 0);
  const close = (open: boolean) => {
    if (!open && !refund.isPending && !refunding) setSelected(null);
  };
  const detail = (
    <>
      {order.isPending || order.isError ? (
        <QueryState
          loading={order.isPending}
          error={order.error}
          retry={order.refetch}
        />
      ) : (
        order.data && (
          <div className="space-y-5">
            <Badge
              tone={order.data.paymentStatus === "paid" ? "success" : "neutral"}
            >
              {paymentLabels[order.data.paymentStatus]}
            </Badge>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Pemesan", order.data.buyer.name],
                ["Email", order.data.buyer.email],
                [
                  "Tiket",
                  `${order.data.quantity} × ${order.data.ticketTypeName}`,
                ],
                ["Total pembayaran", formatRupiah(order.data.totalAmount)],
                ["Dibuat", formatDateTimeCompact(order.data.createdAt)],
                [
                  "Metode pembayaran",
                  paymentMethod(order.data.paymentMethod)?.name ??
                    order.data.paymentMethod ??
                    "Tidak tercatat",
                ],
              ].map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-text-secondary">{key}</dt>
                  <dd className="mt-1 break-words font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <section className="space-y-3">
              <h3 className="font-bold">Tiket peserta</h3>
              {order.data.tickets.length ? (
                order.data.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="space-y-1 rounded-md border border-border p-3 text-sm"
                  >
                    <p className="font-bold">{t.attendeeName}</p>
                    <p>{t.ticketCode}</p>
                    <Badge
                      tone={
                        t.checkInStatus === "cancelled" ? "danger" : "neutral"
                      }
                    >
                      {t.checkInStatus === "used"
                        ? "Sudah check-in"
                        : t.checkInStatus === "cancelled"
                          ? "Dibatalkan"
                          : "Belum check-in"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-secondary">
                  Tiket diterbitkan setelah pembayaran berhasil.
                </p>
              )}
            </section>
            <section className="space-y-3">
              <h3 className="font-bold">Riwayat pembayaran</h3>
              <ol className="space-y-2 text-sm">
                {order.data.timeline.map((entry, index) => (
                  <li
                    key={`${entry.at}-${index}`}
                    className="flex flex-wrap justify-between gap-2"
                  >
                    <span>
                      {paymentLabels[
                        entry.status as keyof typeof paymentLabels
                      ] ?? entry.status}
                    </span>
                    <span className="text-text-secondary">
                      {formatDateTimeCompact(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            {sendError && (
              <Alert title="E-tiket belum terkirim">{sendError}</Alert>
            )}
            {["paid", "partially_refunded"].includes(
              order.data.paymentStatus,
            ) && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={disabled || sending}
                  onClick={async () => {
                    setSending(true);
                    setSendError("");
                    try {
                      await organizerEventsApi.resendTicket(id, selected!);
                      toast.success("Permintaan kirim ulang e-tiket diterima");
                    } catch (e) {
                      setSendError(
                        e instanceof Error ? e.message : "Silakan coba lagi.",
                      );
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  {sending ? "Mengirim…" : "Kirim ulang e-tiket"}
                </Button>
                <Button
                  variant="danger"
                  disabled={disabled || !remaining.length}
                  onClick={() => {
                    refund.reset();
                    setMode("full");
                    setTickets([]);
                    setReason("");
                    setRefunding(true);
                  }}
                >
                  Kembalikan dana
                </Button>
              </div>
            )}
          </div>
        )
      )}
    </>
  );
  return (
    <section className="flex flex-col gap-5 rounded-lg bg-background p-4 has-[[data-state-view]]:flex-1 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Pesanan</h2>
        <Button
          variant="outline"
          disabled={!online || exporting || orders.isPending || orders.isError}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadCsv(
                `pesanan-${id}.csv`,
                [
                  "Kode",
                  "Pemesan",
                  "Email",
                  "Tiket",
                  "Jumlah",
                  "Total",
                  "Status",
                ],
                (number) =>
                  organizerEventsApi.orders(id, {
                    q,
                    paymentStatus: status,
                    page: number,
                  }),
                (r) => [
                  r.orderCode,
                  r.buyer.name,
                  r.buyer.email,
                  r.ticketTypeName,
                  r.quantity,
                  r.totalAmount,
                  paymentLabels[r.paymentStatus],
                ],
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Ekspor gagal");
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Mengekspor…" : "Ekspor CSV"}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <IconInput
          aria-label="Cari pesanan"
          type="search"
          leading={<Search aria-hidden />}
          placeholder="Cari kode pesanan atau nama"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status || "all"}
          onValueChange={(value) => {
            setStatus(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Status pembayaran" className="md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua pembayaran</SelectItem>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {orders.isPending || orders.isError ? (
        <QueryState
          loading={orders.isPending}
          error={orders.error}
          retry={orders.refetch}
        />
      ) : (
        <>
          <DataList
            rows={orders.data.data}
            rowKey={(r) => r.id}
            emptyTitle="Tidak ada pesanan yang cocok"
            columns={[
              {
                key: "code",
                title: "Pesanan",
                render: (r) => (
                  <Button
                    variant="link"
                    className="h-auto min-h-11 whitespace-normal p-0 text-left underline underline-offset-4"
                    onClick={() => {
                      setSelected(r.id);
                      setSendError("");
                    }}
                  >
                    {r.orderCode}
                  </Button>
                ),
              },
              {
                key: "buyer",
                title: "Pemesan",
                render: (r) => (
                  <div>
                    <p className="font-bold">{r.buyer.name}</p>
                    <p className="text-xs text-text-secondary">
                      {r.quantity} × {r.ticketTypeName}
                    </p>
                  </div>
                ),
              },
              {
                key: "total",
                title: "Total",
                numeric: true,
                render: (r) => formatRupiah(r.totalAmount),
              },
              {
                key: "status",
                title: "Pembayaran",
                render: (r) => (
                  <Badge
                    tone={r.paymentStatus === "paid" ? "success" : "neutral"}
                  >
                    {paymentLabels[r.paymentStatus]}
                  </Badge>
                ),
              },
              {
                key: "action",
                title: "Tindakan",
                render: (r) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(r.id);
                      setSendError("");
                    }}
                  >
                    Detail
                  </Button>
                ),
              },
            ]}
            mobile={(r) => (
              <button
                className="w-full cursor-pointer space-y-2 text-left"
                onClick={() => {
                  setSelected(r.id);
                  setSendError("");
                }}
              >
                <p className="font-bold">
                  {r.orderCode} · {r.buyer.name}
                </p>
                <p className="text-sm">
                  {r.quantity} × {r.ticketTypeName} ·{" "}
                  {formatRupiah(r.totalAmount)}
                </p>
                <Badge
                  tone={r.paymentStatus === "paid" ? "success" : "neutral"}
                >
                  {paymentLabels[r.paymentStatus]}
                </Badge>
              </button>
            )}
          />
          <ListPagination
            page={page}
            limit={orders.data.meta.limit}
            total={orders.data.meta.total}
            onChange={setPage}
            disabled={orders.isFetching}
          />
        </>
      )}
      {desktop ? (
        <Sheet open={!!selected} onOpenChange={close}>
          <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-lg">
            <SheetTitle className="pr-8 text-xl font-extrabold">
              {order.data?.orderCode ?? "Detail pesanan"}
            </SheetTitle>
            <SheetDescription>
              Informasi pemesan, tiket, dan pembayaran.
            </SheetDescription>
            {detail}
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={!!selected} onOpenChange={close}>
          <DrawerContent className="max-h-[92dvh] overflow-y-auto">
            <DrawerTitle>
              {order.data?.orderCode ?? "Detail pesanan"}
            </DrawerTitle>
            <DrawerDescription className="mb-5">
              Informasi pemesan, tiket, dan pembayaran.
            </DrawerDescription>
            {detail}
          </DrawerContent>
        </Drawer>
      )}
      <DangerConfirmDialog
        open={refunding}
        onOpenChange={(open) => !refund.isPending && setRefunding(open)}
        title="Kembalikan dana pesanan?"
        description="Tiket yang dipilih akan dibatalkan dan tidak dapat digunakan untuk check-in."
        confirmLabel={`Kembalikan ${formatRupiah(refundAmount)}`}
        loading={refund.isPending}
        error={refund.error?.message}
        canConfirm={!disabled && !!reason.trim() && refundAmount > 0}
        onConfirm={() =>
          selected &&
          refund.mutate(
            {
              orderId: selected,
              input: {
                mode,
                ticketIds: mode === "partial" ? tickets : undefined,
                reason: reason.trim(),
              },
            },
            {
              onSuccess: () => {
                setRefunding(false);
                toast.success("Permintaan pengembalian dana diterima");
              },
            },
          )
        }
      >
        <Field label="Jenis pengembalian" htmlFor="refund-mode">
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as "full" | "partial")}
          >
            <SelectTrigger id="refund-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Semua tiket aktif</SelectItem>
              <SelectItem value="partial">Sebagian tiket</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {mode === "partial" && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-bold">
              Tiket yang dibatalkan
            </legend>
            {remaining.map((t) => (
              <label
                key={t.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              >
                <Checkbox
                  checked={tickets.includes(t.id)}
                  onCheckedChange={(checked) =>
                    setTickets((ids) =>
                      checked === true
                        ? [...ids, t.id]
                        : ids.filter((value) => value !== t.id),
                    )
                  }
                />
                {t.attendeeName} · {t.ticketCode}
              </label>
            ))}
          </fieldset>
        )}
        <Field label="Alasan pengembalian" htmlFor="refund-reason">
          <Textarea
            id="refund-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="text-sm font-bold">
          Jumlah pengembalian: {formatRupiah(refundAmount)}
        </p>
      </DangerConfirmDialog>
    </section>
  );
}

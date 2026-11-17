"use client";

import { DateTimePicker } from "@/components/elements/DateTimePicker";
import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import {
  useAddTicketType,
  useUpdateTicketType,
  useRemoveTicketType,
} from "../hooks";
import { ticketErrors } from "../editor-schema";
import { toLocalInput, fromLocalInput } from "../date-input";
import type { OrgTicketType, TicketTypeInput } from "../types";
import { formatRupiah } from "@/lib/format";

const blank: TicketTypeInput = {
  name: "",
  description: "Tiket masuk acara",
  price: 0,
  capacity: 1,
  salesStartsAt: "",
  salesEndsAt: "",
};
export function TicketEditor({
  eventId,
  tickets,
  startsAt,
  timezone,
  disabled,
  onChanged,
}: {
  eventId: string;
  tickets: OrgTicketType[];
  startsAt: string;
  timezone: string;
  disabled?: boolean;
  onChanged: (tickets: OrgTicketType[]) => void;
}) {
  const add = useAddTicketType(eventId);
  const update = useUpdateTicketType(eventId);
  const remove = useRemoveTicketType(eventId);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<TicketTypeInput>(blank);
  const [free, setFree] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<OrgTicketType | null>(null);
  const selected = tickets.find((t) => t.id === editing);
  const busy = add.isPending || update.isPending || remove.isPending;
  const open = (ticket?: OrgTicketType, copy = false) => {
    setEditing(ticket && !copy ? ticket.id : "new");
    setForm(
      ticket
        ? {
            ...ticket,
            salesStartsAt: toLocalInput(ticket.salesStartsAt, timezone),
            salesEndsAt: toLocalInput(ticket.salesEndsAt, timezone),
            name: copy ? `${ticket.name} salinan` : ticket.name,
          }
        : blank,
    );
    setFree(ticket?.price === 0);
    setError("");
  };
  const field = (key: keyof TicketTypeInput, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function save() {
    if (!eventId) {
      setError("Isi nama acara dan simpan draf terlebih dahulu.");
      return;
    }
    const input = { ...form, price: free ? 0 : form.price };
    const message = ticketErrors(
      input,
      startsAt,
      selected ? Math.max(1, selected.sold + selected.reserved) : 1,
    );
    if (message) {
      setError(message);
      return;
    }
    input.salesStartsAt = fromLocalInput(input.salesStartsAt, timezone);
    input.salesEndsAt = fromLocalInput(input.salesEndsAt, timezone);
    try {
      if (selected) {
        await update.mutateAsync({ typeId: selected.id, input });
        onChanged(
          tickets.map((t) => (t.id === selected.id ? { ...t, ...input } : t)),
        );
      } else {
        const result = (await add.mutateAsync(input)) as {
          data: OrgTicketType;
        };
        onChanged([...tickets, result.data]);
      }
      setEditing(null);
      toast.success(
        selected ? "Jenis tiket diperbarui" : "Jenis tiket ditambahkan",
      );
    } catch {
      setError(
        "Jenis tiket gagal disimpan. Periksa koneksi Anda lalu coba lagi.",
      );
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">Jenis tiket</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Peserta memilih salah satu jenis tiket saat membeli.
        </p>
      </div>
      {!tickets.length && editing === null && (
        <p className="rounded-lg bg-surface p-5 text-sm text-text-secondary">
          Belum ada jenis tiket. Tambahkan minimal satu sebelum menerbitkan
          acara.
        </p>
      )}
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
        >
          <div className="min-w-0">
            <p className="font-bold">{ticket.name}</p>
            <p className="mt-1 text-sm text-text-secondary">
              Kuota {ticket.capacity}, terjual {ticket.sold}, dipesan{" "}
              {ticket.reserved}
            </p>
            <p className="mt-2 font-bold">
              {ticket.price === 0 ? "Gratis" : formatRupiah(ticket.price)}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Ubah ${ticket.name}`}
              disabled={disabled || busy}
              onClick={() => open(ticket)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Duplikat ${ticket.name}`}
              disabled={disabled || busy}
              onClick={() => open(ticket, true)}
            >
              <Copy className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Hapus ${ticket.name}`}
              disabled={disabled || busy || ticket.sold + ticket.reserved > 0}
              onClick={() => setDeleting(ticket)}
            >
              <Trash2 className="size-4 text-danger-ink" />
            </Button>
          </div>
        </div>
      ))}
      {editing !== null && (
        <div className="space-y-4 rounded-lg border border-border p-4 md:p-6">
          <h3 className="font-extrabold">
            {selected ? `Ubah tiket ${selected.name}` : "Jenis tiket baru"}
          </h3>
          <Field label="Nama tiket" htmlFor="ticket-name">
            <Input
              id="ticket-name"
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Harga"
              htmlFor="ticket-price"
              helper={
                selected?.sold
                  ? "Harga terkunci karena tiket sudah terjual."
                  : "Harga dalam rupiah"
              }
            >
              <Input
                id="ticket-price"
                type="number"
                min={0}
                step={1}
                value={free ? 0 : form.price}
                disabled={free || !!selected?.sold}
                onChange={(e) => field("price", Number(e.target.value))}
              />
            </Field>
            <Field label="Kuota" htmlFor="ticket-capacity">
              <Input
                id="ticket-capacity"
                type="number"
                min={
                  selected ? Math.max(1, selected.sold + selected.reserved) : 1
                }
                step={1}
                value={form.capacity}
                onChange={(e) => field("capacity", Number(e.target.value))}
              />
            </Field>
            <Field label="Mulai dijual" htmlFor="sales-start">
              <DateTimePicker
                id="sales-start"
                value={form.salesStartsAt.slice(0, 16)}
                onChange={(value) => field("salesStartsAt", value)}
              />
            </Field>
            <Field label="Akhir dijual" htmlFor="sales-end">
              <DateTimePicker
                id="sales-end"
                value={form.salesEndsAt.slice(0, 16)}
                onChange={(value) => field("salesEndsAt", value)}
              />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={free}
              disabled={!!selected?.sold}
              onChange={(e) => setFree(e.target.checked)}
              className="size-5 accent-foreground"
            />
            Tiket gratis
          </label>
          {free && <Badge tone="brand">Harga Rp0</Badge>}
          {error && (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              loading={busy}
              disabled={disabled}
              onClick={() => void save()}
            >
              {busy ? "Menyimpan" : "Simpan tiket"}
            </Button>
          </div>
        </div>
      )}
      {editing === null && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => open()}
        >
          <Plus className="size-4" />
          Tambah jenis tiket
        </Button>
      )}
      <ResponsiveDialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value && !busy) setDeleting(null);
        }}
        title={`Hapus tiket ${deleting?.name ?? ""}?`}
        description="Jenis tiket ini akan dihapus dari acara."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!deleting) return;
              try {
                await remove.mutateAsync(deleting.id);
                onChanged(tickets.filter((t) => t.id !== deleting.id));
                setDeleting(null);
              } catch {
                toast.error("Jenis tiket gagal dihapus. Silakan coba lagi.");
              }
            }}
          >
            Hapus tiket
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

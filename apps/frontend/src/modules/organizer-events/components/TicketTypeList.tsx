"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/elements/QueryState";
import { DataList } from "@/components/elements/DataList";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { formatRupiah } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { useOrgEvent, useRemoveTicketType, useSetTicketSales } from "../hooks";
import type { OrgTicketType } from "../types";
export function TicketTypeList() {
  const { id } = useParams<{ id: string }>();
  const event = useOrgEvent(id);
  const setSales = useSetTicketSales(id);
  const online = useOnline();
  const me = useWorkspaceMe();
  const [selected, setSelected] = useState<OrgTicketType | null>(null);
  const remove = useRemoveTicketType(id);
  const [deleting, setDeleting] = useState<OrgTicketType | null>(null);
  if (event.isPending || event.isError)
    return (
      <QueryState
        loading={event.isPending}
        error={event.error}
        retry={event.refetch}
      />
    );
  const disabled =
    !online ||
    !!me.data?.organizer.frozen ||
    ["cancelled", "ended"].includes(event.data.status);
  const action = (t: OrgTicketType) => (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setSales.reset();
          setSelected(t);
        }}
      >
        {t.salesStopped ? "Lanjutkan penjualan" : "Hentikan penjualan"}
      </Button>
      {/* Jenis tiket hanya bisa dihapus bila belum ada yang terjual atau sedang dipesan. */}
      {t.sold + t.reserved === 0 && (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Hapus ${t.name}`}
          onClick={() => {
            remove.reset();
            setDeleting(t);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
  return (
    <section className="space-y-4 rounded-lg bg-background p-4 md:p-6">
      <h2 className="text-xl font-extrabold">Jenis tiket</h2>
      <p className="text-sm text-text-secondary">
        Menghentikan penjualan tidak membatalkan tiket yang sudah dibeli.
      </p>
      <DataList
        rows={event.data.ticketTypes}
        rowKey={(t) => t.id}
        emptyTitle="Belum ada jenis tiket"
        columns={[
          {
            key: "name",
            title: "Tiket",
            render: (t) => (
              <div>
                <p className="font-bold">{t.name}</p>
                <p>{formatRupiah(t.price)}</p>
              </div>
            ),
          },
          {
            key: "sold",
            title: "Terjual / kuota",
            render: (t) => `${t.sold} / ${t.capacity}`,
          },
          {
            key: "status",
            title: "Status",
            render: (t) => (
              <Badge tone={t.salesStopped ? "warning" : "success"}>
                {t.salesStopped ? "Dihentikan" : "Aktif"}
              </Badge>
            ),
          },
          { key: "action", title: "Tindakan", render: action },
        ]}
        mobile={(t) => (
          <div className="space-y-3">
            <p className="font-bold">{t.name}</p>
            <p className="text-sm">
              {formatRupiah(t.price)} · {t.sold} / {t.capacity} terjual
            </p>
            <Badge tone={t.salesStopped ? "warning" : "success"}>
              {t.salesStopped ? "Dihentikan" : "Aktif"}
            </Badge>
            <div className="flex justify-start">{action(t)}</div>
          </div>
        )}
      />
      <DangerConfirmDialog
        open={!!selected}
        onOpenChange={(open) =>
          !open && !setSales.isPending && setSelected(null)
        }
        title={
          selected?.salesStopped
            ? "Lanjutkan penjualan tiket?"
            : "Hentikan penjualan tiket?"
        }
        description={`Penjualan ${selected?.name ?? "tiket"} akan ${selected?.salesStopped ? "dibuka kembali sesuai jadwal penjualan" : "dihentikan. Tiket terjual tetap berlaku"}.`}
        confirmLabel={
          selected?.salesStopped ? "Lanjutkan penjualan" : "Hentikan penjualan"
        }
        canConfirm={!disabled}
        loading={setSales.isPending}
        error={setSales.error?.message}
        onConfirm={() =>
          selected &&
          setSales.mutate(
            { typeId: selected.id, stopped: !selected.salesStopped },
            {
              onSuccess: () => {
                setSelected(null);
                toast.success("Status penjualan diperbarui");
              },
            },
          )
        }
      />
      <DangerConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && !remove.isPending && setDeleting(null)}
        title="Hapus jenis tiket?"
        description={`${deleting?.name ?? "Jenis tiket"} dihapus dari acara dan tidak bisa dibeli lagi. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus jenis tiket"
        canConfirm={!disabled}
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success("Jenis tiket dihapus");
            },
          })
        }
      />
    </section>
  );
}

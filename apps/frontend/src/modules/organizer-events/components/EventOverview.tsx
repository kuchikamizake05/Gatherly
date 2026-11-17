"use client";
import { useParams } from "next/navigation";
import { StatCard } from "@/components/elements/StatCard";
import { QueryState } from "@/components/elements/QueryState";
import { formatRupiahShort, formatRupiah } from "@/lib/format";
import { useOrgEvent, useOrgEventSummary } from "../hooks";
export function EventOverview() {
  const { id } = useParams<{ id: string }>();
  const summary = useOrgEventSummary(id);
  const event = useOrgEvent(id);
  if (summary.isPending || summary.isError || event.isPending || event.isError)
    return (
      <QueryState
        loading={summary.isPending || event.isPending}
        error={summary.error ?? event.error}
        retry={() => {
          summary.refetch();
          event.refetch();
        }}
      />
    );
  const data = summary.data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Penjualan kotor"
          value={formatRupiahShort(data.grossPaidSales)}
          caption={formatRupiah(data.grossPaidSales)}
        />
        <StatCard
          label="Tiket terjual"
          value={data.sold}
          caption={`Dari ${data.capacity} tiket`}
        />
        <StatCard
          label="Sudah check-in"
          value={data.checkedIn}
          caption={`${data.sold ? Math.round((data.checkedIn / data.sold) * 100) : 0}% dari tiket terjual`}
        />
        <StatCard
          label="Tiket tersedia"
          value={data.available}
          caption={`${data.reserved} tiket sedang dipesan`}
        />
      </div>
      <section className="space-y-4 rounded-lg bg-background p-4 md:p-6">
        <h2 className="text-xl font-extrabold">Penjualan per jenis tiket</h2>
        {event.data.ticketTypes.length ? (
          event.data.ticketTypes.map((ticket) => (
            <div
              key={ticket.id}
              className="space-y-2 border-b border-border pb-4 last:border-0"
            >
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-bold">{ticket.name}</span>
                <span>
                  {ticket.sold} / {ticket.capacity} terjual
                </span>
              </div>
              <div
                role="meter"
                aria-label={`Penjualan ${ticket.name}`}
                aria-valuenow={ticket.sold}
                aria-valuemin={0}
                aria-valuemax={ticket.capacity}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${ticket.capacity ? Math.min(100, (ticket.sold / ticket.capacity) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-secondary">
                {ticket.reserved} dipesan ·{" "}
                {Math.max(0, ticket.capacity - ticket.sold - ticket.reserved)}{" "}
                tersedia
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-text-secondary">Belum ada jenis tiket.</p>
        )}
      </section>
    </div>
  );
}

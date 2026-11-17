import { formatDateShort, formatRupiah, formatRupiahShort } from "@/lib/format";
export function SalesChart({
  rows,
}: {
  rows?: { date: string; amount: number }[];
}) {
  if (!rows?.length)
    return (
      <p className="rounded-lg bg-background p-6 text-sm text-text-secondary">
        Rincian penjualan harian belum tersedia untuk periode ini.
      </p>
    );
  const max = Math.max(1, ...rows.map((row) => row.amount));
  const points = rows
    .map(
      (row, index) =>
        `${40 + (index / Math.max(1, rows.length - 1)) * 650},${170 - (row.amount / max) * 145}`,
    )
    .join(" ");
  return (
    <section className="space-y-4 rounded-lg bg-background p-4 md:p-6">
      <h2 className="text-lg font-extrabold">Penjualan harian</h2>
      <svg
        viewBox="0 0 720 205"
        role="img"
        aria-label={`Grafik penjualan dari ${formatDateShort(rows[0].date)} hingga ${formatDateShort(rows.at(-1)!.date)}`}
        className="w-full"
      >
        <title>Penjualan harian berdasarkan pembayaran berhasil</title>
        {[25, 97, 170].map((y) => (
          <line
            key={y}
            x1="40"
            x2="690"
            y1={y}
            y2={y}
            stroke="currentColor"
            className="text-border"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          className="text-foreground"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text x="40" y="198" fontSize="12" fill="currentColor">
          {formatDateShort(rows[0].date)}
        </text>
        <text
          x="690"
          y="198"
          textAnchor="end"
          fontSize="12"
          fill="currentColor"
        >
          {formatDateShort(rows.at(-1)!.date)}
        </text>
        <text x="690" y="17" textAnchor="end" fontSize="12" fill="currentColor">
          {formatRupiahShort(max)}
        </text>
      </svg>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Lihat angka penjualan harian
        </summary>
        <dl className="grid max-h-64 grid-cols-2 gap-x-4 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.date}
              className="flex flex-wrap justify-between gap-2 border-b border-border py-2"
            >
              <dt>{formatDateShort(row.date)}</dt>
              <dd>{formatRupiah(row.amount)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

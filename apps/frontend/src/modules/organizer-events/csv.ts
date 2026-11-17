import type { Paginated } from "@/lib/api/client";

// Prefix spreadsheet formulas, including formulas after leading whitespace.
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function downloadCsv<T>(
  name: string,
  headers: string[],
  fetchPage: (page: number) => Promise<Paginated<T>>,
  cells: (row: T) => unknown[],
) {
  const rows: T[] = [];
  for (let number = 1; ; number++) {
    const response = await fetchPage(number);
    rows.push(...response.data);
    if (rows.length >= response.meta.total) break;
    if (!response.data.length || number > 500)
      throw new Error(
        "Ekspor belum lengkap. Persempit pencarian lalu coba lagi.",
      );
  }
  const blob = new Blob(
    [
      "\uFEFF",
      [headers, ...rows.map(cells)]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

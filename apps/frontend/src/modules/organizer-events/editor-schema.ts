import { z } from "zod";

export const editorSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Nama acara wajib diisi")
      .max(80, "Nama acara maksimal 80 karakter"),
    category: z.string().min(1, "Pilih kategori acara"),
    description: z
      .string()
      .trim()
      .min(1, "Deskripsi wajib diisi")
      .max(5000, "Deskripsi maksimal 5.000 karakter"),
    posterAssetId: z.string().min(1, "Poster wajib diunggah"),
    startsAt: z.string().min(1, "Tanggal mulai wajib diisi"),
    endsAt: z.string().min(1, "Tanggal selesai wajib diisi"),
    timezone: z.string(),
    locationType: z.enum(["offline", "online"]),
    venueName: z
      .string()
      .trim()
      .min(1, "Nama tempat atau tautan acara wajib diisi"),
    address: z.string(),
    city: z.string(),
    province: z.string(),
    postalCode: z.string(),
    terms: z.array(z.string().trim().min(1, "Ketentuan tidak boleh kosong")),
    performerLabel: z.string(),
    showPerformers: z.boolean(),
    showRemaining: z.boolean(),
    performers: z.array(
      z.object({
        name: z.string().trim(),
        note: z.string(),
        time: z.string(),
        photoAssetId: z.string().optional(),
        photoUrl: z.string().optional(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.startsAt && !Number.isFinite(Date.parse(data.startsAt)))
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Tanggal mulai tidak valid",
      });
    if (
      data.endsAt &&
      (!Number.isFinite(Date.parse(data.endsAt)) ||
        new Date(data.endsAt) <= new Date(data.startsAt))
    )
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Tanggal selesai harus setelah tanggal mulai",
      });
    if (data.locationType === "offline")
      for (const field of ["address", "city"] as const)
        if (!data[field].trim())
          ctx.addIssue({
            code: "custom",
            path: [field],
            message:
              field === "city" ? "Kota wajib diisi" : "Alamat wajib diisi",
          });
    if (data.locationType === "online" && !/^https:\/\//.test(data.venueName))
      ctx.addIssue({
        code: "custom",
        path: ["venueName"],
        message: "Gunakan tautan acara berawalan https://",
      });
    if (data.showPerformers)
      data.performers.forEach((performer, index) => {
        if (!performer.name)
          ctx.addIssue({
            code: "custom",
            path: ["performers", index, "name"],
            message: "Nama penampil wajib diisi",
          });
      });
  });

export type EditorValues = z.infer<typeof editorSchema>;
export const emptyEditor: EditorValues = {
  title: "",
  category: "",
  description: "",
  posterAssetId: "",
  startsAt: "",
  endsAt: "",
  timezone: "Asia/Jakarta",
  locationType: "offline",
  venueName: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  terms: [],
  performerLabel: "Penampil",
  showPerformers: false,
  showRemaining: true,
  performers: [],
};
export const stepFields = [
  ["title", "category", "description", "posterAssetId"],
  ["startsAt", "endsAt", "venueName", "address", "city"],
  [],
  ["terms", "performers"],
  [],
];

export function ticketErrors(
  input: {
    name: string;
    price: number;
    capacity: number;
    salesStartsAt: string;
    salesEndsAt: string;
  },
  startsAt: string,
  minimum = 1,
): string | null {
  if (input.name.trim().length < 2) return "Nama tiket minimal 2 karakter.";
  if (!Number.isInteger(input.price) || input.price < 0)
    return "Harga harus berupa rupiah utuh dan tidak negatif.";
  if (!Number.isInteger(input.capacity) || input.capacity < minimum)
    return `Kuota minimal ${minimum}, termasuk tiket terjual dan sedang dipesan.`;
  if (
    !Number.isFinite(Date.parse(input.salesStartsAt)) ||
    !Number.isFinite(Date.parse(input.salesEndsAt)) ||
    new Date(input.salesEndsAt) <= new Date(input.salesStartsAt)
  )
    return "Akhir penjualan harus setelah mulai penjualan.";
  if (!startsAt || new Date(input.salesEndsAt) > new Date(startsAt))
    return "Penjualan harus berakhir sebelum acara dimulai.";
  return null;
}

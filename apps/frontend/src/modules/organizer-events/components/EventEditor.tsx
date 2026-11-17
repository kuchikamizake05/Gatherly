"use client";

import { LocationPreview } from "./LocationPreview";
import { SortableList } from "@/components/elements/SortableList";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/elements/DateTimePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/elements/PageHeader";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { QueryState } from "@/components/elements/QueryState";
import { StateView } from "@/components/elements/StateView";
import { RegionFields } from "@/components/elements/RegionFields";
import { EventImageUpload } from "@/modules/organizer-events/components/EventImageUpload";
import { useOnline } from "@/hooks/use-online";
import { useDebounced } from "@/hooks/use-debounced";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { cn } from "@/lib/utils";
import { formatRupiah, formatTime, formatEventDateTime } from "@/lib/format";
import { organizerEventsApi } from "../api";
import {
  useCreateEvent,
  useOrgEvent,
  useUpdateEvent,
  usePublishEvent,
} from "../hooks";
import {
  emptyEditor,
  editorSchema,
  stepFields,
  type EditorValues,
} from "../editor-schema";
import type { EventInput, OrgEvent, OrgTicketType } from "../types";
import { TicketEditor } from "./TicketEditor";
import { toLocalInput, fromLocalInput } from "../date-input";

const steps = [
  ["Info acara", "Nama, kategori, poster"],
  ["Waktu & tempat", "Jadwal dan lokasi"],
  ["Tiket", "Jenis, harga, kuota"],
  ["Detail", "Ketentuan, penampil"],
  ["Tinjau & terbitkan", "Periksa sebelum tayang"],
];
const categories = [
  "Musik",
  "Seni",
  "Olahraga",
  "Lokakarya",
  "Komunitas",
  "Kuliner",
];
/**
 * Backend baru menerima acara bila kolom wajib lengkap (deskripsi, kategori, jadwal, tempat).
 * Sebelum itu draf hanya disimpan di perangkat, supaya autosave tidak terus ditolak server.
 */
function serverReady(values: EditorValues) {
  const filled = (v: unknown, min = 1) =>
    typeof v === "string" && v.trim().length >= min;
  return (
    filled(values.title, 2) &&
    filled(values.description) &&
    filled(values.category, 2) &&
    filled(values.startsAt) &&
    filled(values.endsAt) &&
    values.endsAt > values.startsAt &&
    filled(values.venueName, 2) &&
    filled(values.address, 2) &&
    filled(values.city, 2)
  );
}

/**
 * Data untuk backend. Isian kosong dibuang dulu karena backend menolak teks kosong:
 * ketentuan kosong, kartu pengisi acara tanpa nama, serta poster atau foto yang belum diunggah.
 */
function payload(values: EditorValues): EventInput {
  const filled = (v?: string) => (v && v.trim() ? v : undefined);
  return {
    ...values,
    posterAssetId: filled(values.posterAssetId),
    startsAt: fromLocalInput(values.startsAt, values.timezone),
    endsAt: fromLocalInput(values.endsAt, values.timezone),
    terms: values.terms.filter((term) => term.trim()),
    performers: values.showPerformers
      ? values.performers
          .filter((p) => p.name.trim())
          .map((p) => ({
            ...p,
            photoAssetId: filled(p.photoAssetId),
            // Backend mengisi photoUrl sendiri dari photoAssetId dalam bentuk relatif (/api/v1/media/...),
            // tapi hanya menerima URL lengkap. Jadi URL hanya dikirim bila tidak ada asset dan berupa http(s).
            photoUrl:
              !filled(p.photoAssetId) && /^https?:\/\//.test(p.photoUrl ?? "")
                ? p.photoUrl
                : undefined,
          }))
      : [],
  };
}

/** Nama bagian editor untuk kolom yang ditolak backend, misalnya "performers.0.name". */
const FIELD_SECTIONS: Record<string, string> = {
  title: "nama acara",
  description: "deskripsi",
  category: "kategori",
  posterAssetId: "poster",
  startsAt: "waktu mulai",
  endsAt: "waktu selesai",
  timezone: "zona waktu",
  venueName: "nama tempat",
  address: "alamat",
  city: "kota",
  terms: "ketentuan",
  performers: "pengisi acara",
  performerLabel: "sebutan pengisi acara",
  checkInOpensAt: "waktu buka check-in",
  checkInClosesAt: "waktu tutup check-in",
};
function rejectedSections(fields?: Record<string, string>) {
  const names = [
    ...new Set(
      Object.keys(fields ?? {}).map(
        (key) => FIELD_SECTIONS[key.split(".")[0] ?? ""] ?? "isian lain",
      ),
    ),
  ];
  return names.length ? `Periksa ${names.join(", ")}.` : "";
}

export function EventEditor({ id }: { id?: string }) {
  const event = useOrgEvent(id ?? "");
  if (id && (event.isPending || event.isError))
    return (
      <QueryState
        loading={event.isPending}
        error={event.error}
        retry={event.refetch}
      />
    );
  return <EditorForm key={id ?? "new"} initial={event.data} />;
}

function EditorForm({ initial }: { initial?: OrgEvent }) {
  const online = useOnline();
  const me = useWorkspaceMe();
  const frozen = !!me.data?.organizer.frozen;
  const create = useCreateEvent();
  const [eventId, setEventId] = useState(initial?.id ?? "");
  const update = useUpdateEvent(eventId);
  const publish = usePublishEvent(eventId);
  const [step, setStep] = useState(0);
  const [highest, setHighest] = useState(initial ? 4 : 0);
  const [tickets, setTickets] = useState<OrgTicketType[]>(
    initial?.ticketTypes ?? [],
  );
  const [poster, setPoster] = useState(initial?.posterUrl ?? "");
  const [status, setStatus] = useState("Draf belum disimpan");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"publish" | "update" | null>(
    null,
  );
  const [published, setPublished] = useState(false);
  const initialValues: EditorValues = initial
    ? {
        ...emptyEditor,
        ...initial,
        posterAssetId: initial.posterAssetId ?? "",
        startsAt: toLocalInput(initial.startsAt, initial.timezone),
        endsAt: toLocalInput(initial.endsAt, initial.timezone),
        showPerformers: !!initial.performers?.length,
        performers: (initial.performers ?? []).map((p) => ({
          ...p,
          photoAssetId: p.photoAssetId ?? undefined,
          photoUrl: p.photoUrl ?? undefined,
        })),
      }
    : emptyEditor;
  const form = useForm<EditorValues>({
    defaultValues: initialValues,
    mode: "onBlur",
  });
  const values = form.watch();
  const delayed = useDebounced(values, 2000);
  const storageKey = `gatherly.editor.${me.data?.username ?? "organizer"}.${initial?.id ?? "new"}`;
  const restored = useRef(false);
  const saving = useRef(false);
  const saved = useRef(JSON.stringify(initialValues));
  const latest = useRef(values);
  latest.current = values;
  const latestPoster = useRef(poster);
  latestPoster.current = poster;
  const saveRef = useRef<(manual?: boolean) => Promise<boolean>>(
    async () => false,
  );
  const revision = useRef(initial?.id ?? "");
  const busy = create.isPending || update.isPending || publish.isPending;
  const isPublished = initial?.publicationStatus === "published";
  useEffect(
    () => () => {
      if (
        !restored.current ||
        !latest.current.title.trim() ||
        JSON.stringify(latest.current) === saved.current
      )
        return;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            values: latest.current,
            poster: latestPoster.current,
            eventId: revision.current,
          }),
        );
      } catch {}
    },
    [storageKey],
  );
  useEffect(() => {
    if (restored.current || !me.data) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.version === 1) {
          form.reset({ ...initialValues, ...cached.values });
          setPoster(cached.poster ?? "");
          setEventId(cached.eventId ?? initial?.id ?? "");
          revision.current = cached.eventId ?? initial?.id ?? "";
          setStatus("Draf dipulihkan dari perangkat");
          // Draf acara baru yang sudah tersimpan di akun: ambil jenis tiket dari server, supaya
          // tiket yang sudah dibuat tidak dianggap kosong lalu ditambahkan ulang (tiket dobel).
          if (cached.eventId && !initial)
            organizerEventsApi
              .get(cached.eventId)
              .then((res) => setTickets(res.data.ticketTypes))
              .catch(() => {});
        }
      }
    } catch {
      setError(
        "Draf perangkat tidak dapat dibaca. Periksa penyimpanan browser Anda.",
      );
    }
  }, [me.data, storageKey]);
  function cache() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          values: latest.current,
          poster,
          eventId: revision.current,
        }),
      );
      return true;
    } catch {
      setError(
        "Draf belum tersimpan di perangkat. Penyimpanan browser mungkin penuh.",
      );
      return false;
    }
  }
  async function save(manual = false) {
    if (saving.current) return false;
    const current = latest.current;
    if (!current.title.trim()) {
      if (manual) form.setError("title", { message: "Nama acara wajib diisi" });
      return false;
    }
    if (!cache()) return false;
    if (!online || frozen) {
      setStatus(
        !online
          ? "Luring, draf disimpan di perangkat"
          : "Draf disimpan di perangkat",
      );
      return true;
    }
    if (!revision.current && !serverReady(current)) {
      setStatus("Draf tersimpan di perangkat");
      if (manual)
        toast("Draf disimpan di perangkat", {
          id: "draft-local",
          description:
            "Lengkapi deskripsi, kategori, jadwal, dan tempat agar draf tersimpan di akun Anda.",
        });
      return true;
    }
    saving.current = true;
    setStatus("Menyimpan draf…");
    const signature = JSON.stringify(current);
    try {
      if (!revision.current) {
        const result = await create.mutateAsync(payload(current));
        revision.current = result.data.id;
        setEventId(result.data.id);
      } else await update.mutateAsync(payload(current));
      saved.current = signature;
      cache();
      setSavedAt(formatTime(new Date()).replace(" WIB", ""));
      setStatus("");
      setError("");
      if (manual) toast.success("Draf disimpan");
      return true;
    } catch (e) {
      setStatus("Draf tersimpan di perangkat");
      // Error koneksi memakai pesan koneksi. Error lain (misalnya isian ditolak) memakai pesan dari layanan.
      const offline = e instanceof ApiError && e.status === 0;
      setError(
        offline || !(e instanceof Error)
          ? "Draf belum terkirim. Periksa koneksi Anda lalu simpan kembali."
          : `Draf belum terkirim. ${
              (e instanceof ApiError && rejectedSections(e.fields)) || e.message
            }`,
      );
      return false;
    } finally {
      saving.current = false;
    }
  }
  saveRef.current = save;
  useEffect(() => {
    if (
      !restored.current ||
      !delayed.title?.trim() ||
      JSON.stringify(delayed) === saved.current
    )
      return;
    if (isPublished) {
      cache();
      return;
    }
    void saveRef.current();
  }, [delayed, online, frozen, isPublished]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              version: 1,
              values: latest.current,
              poster,
              eventId: revision.current,
            }),
          );
        } catch {
          event.preventDefault();
        }
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [storageKey, poster]);
  function validate(target: number, all = false) {
    form.clearErrors();
    setError("");
    const current = form.getValues();
    const result = editorSchema.safeParse(current);
    const relevant = result.success
      ? []
      : result.error.issues.filter(
          (issue) => all || stepFields[target].includes(String(issue.path[0])),
        );
    for (const issue of relevant)
      form.setError(issue.path.join(".") as keyof EditorValues, {
        message: issue.message,
      });
    if ((all || target === 2) && !tickets.length) {
      setError("Tambahkan minimal satu jenis tiket sebelum menerbitkan acara.");
      if (all) setStep(2);
      return false;
    }
    if (
      (all || target === 1) &&
      values.startsAt &&
      new Date(payload(values).startsAt) <= new Date() &&
      !isPublished
    ) {
      form.setError("startsAt", {
        message: "Acara baru harus dimulai pada waktu mendatang",
      });
      if (all) setStep(1);
      return false;
    }
    if (relevant.length) {
      if (all)
        setStep(
          Math.max(
            0,
            stepFields.findIndex((fields) =>
              fields.includes(String(relevant[0].path[0])),
            ),
          ),
        );
      setTimeout(
        () =>
          document
            .querySelector<HTMLElement>(
              relevant[0].path[0] === "city"
                ? "#region-regency"
                : relevant[0].path[0] === "province"
                  ? "#region-province"
                  : relevant[0].path[0] === "posterAssetId"
                    ? 'input[type="file"]'
                    : `[name="${relevant[0].path.join(".")}"]`,
            )
            ?.focus(),
        0,
      );
      return false;
    }
    return true;
  }
  const next = () => {
    if (validate(step)) {
      const target = Math.min(4, step + 1);
      setStep(target);
      setHighest(Math.max(highest, target));
      window.scrollTo({ top: 0 });
    }
  };
  function input(
    name: keyof EditorValues,
    label: string,
    type = "text",
    helper?: string,
  ) {
    const message = form.formState.errors[name]?.message;
    const validate = () => {
      const result = editorSchema.safeParse(form.getValues());
      const issue = result.success
        ? undefined
        : result.error.issues.find((i) => i.path[0] === name);
      if (issue) form.setError(name, { message: issue.message });
      else form.clearErrors(name);
    };
    if (type === "datetime-local")
      return (
        <Field
          label={label}
          htmlFor={name}
          helper={helper}
          error={typeof message === "string" ? message : undefined}
        >
          <DateTimePicker
            id={name}
            value={String(values[name] ?? "")}
            onChange={(value) =>
              form.setValue(name, value as never, { shouldDirty: true })
            }
            onBlur={validate}
            invalid={!!message}
            describedBy={`${name}-message`}
            min={new Date()}
          />
        </Field>
      );
    return (
      <Field
        label={label}
        htmlFor={name}
        helper={helper}
        error={typeof message === "string" ? message : undefined}
      >
        <Input
          id={name}
          type={type}
          {...form.register(name)}
          aria-invalid={!!message}
          aria-describedby={`${name}-message`}
          onBlur={() => {
            const result = editorSchema.safeParse(form.getValues());
            const issue = result.success
              ? undefined
              : result.error.issues.find((i) => i.path[0] === name);
            if (issue) form.setError(name, { message: issue.message });
            else form.clearErrors(name);
          }}
        />
      </Field>
    );
  }
  // Status draf mengikuti ada atau tidaknya perubahan sejak penyimpanan terakhir ke akun.
  const dirty = JSON.stringify(values) !== saved.current;
  const draftStatus =
    status === "Menyimpan draf…"
      ? status
      : !dirty
        ? savedAt
          ? `Semua perubahan tersimpan pukul ${savedAt}`
          : initial
            ? "Belum ada perubahan"
            : "Draf belum disimpan"
        : !online
          ? "Luring. Perubahan disimpan di perangkat."
          : !revision.current && !serverReady(values)
            ? "Perubahan disimpan di perangkat. Lengkapi deskripsi, kategori, jadwal, dan tempat untuk menyimpan ke akun."
            : status === "Draf tersimpan di perangkat" && error
              ? "Perubahan belum tersimpan ke akun."
              : "Ada perubahan yang belum disimpan.";
  // Id stabil per ketentuan supaya daftar bisa digeser. Ikut panjang daftar bila berubah dari luar (draf dipulihkan).
  const termIds = useRef<string[]>([]);
  while (termIds.current.length < values.terms.length)
    termIds.current.push(Math.random().toString(36).slice(2));
  termIds.current.length = values.terms.length;
  const moveTerm = (from: number, to: number) => {
    const move = <T,>(list: T[]) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    };
    termIds.current = move(termIds.current);
    form.setValue("terms", move(values.terms), { shouldDirty: true });
  };
  const removeTerm = (index: number) => {
    termIds.current = termIds.current.filter((_, i) => i !== index);
    form.setValue(
      "terms",
      values.terms.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };
  async function confirm() {
    setError("");
    if (!online || frozen || !(await save())) return;
    try {
      if (confirmation === "publish") {
        await publish.mutateAsync();
        setPublished(true);
      } else toast.success("Perubahan acara disimpan");
      localStorage.removeItem(storageKey);
      setConfirmation(null);
    } catch {
      setError(
        "Acara gagal diterbitkan. Draf tetap tersimpan, silakan coba lagi.",
      );
    }
  }
  if (published)
    return (
      <StateView
        illustration="success"
        title="Acara berhasil diterbitkan"
        description={`${values.title} sudah tampil di Jelajahi.`}
        action={
          <Button asChild>
            <Link href={`/events/${eventId}`}>Kelola acara</Link>
          </Button>
        }
      />
    );
  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 pb-8 md:p-8">
      <PageHeader title={isPublished ? "Ubah acara" : "Buat acara"} />
      {frozen && (
        <div
          role="status"
          className="rounded-lg bg-warning-tint p-4 text-sm text-warning-ink"
        >
          <strong>Akun organizer dibekukan sementara.</strong> Draf disimpan di
          perangkat. Penerbitan belum tersedia selama peninjauan.
        </div>
      )}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Langkah pembuatan acara"
          className="h-fit rounded-lg bg-background p-4 xl:sticky xl:top-24"
        >
          <p className="mb-3 text-xs text-text-secondary">
            Langkah {step + 1} dari 5
            <span className="xl:hidden">, {steps[step][0]}</span>
          </p>
          <ol className="flex justify-center gap-2 xl:flex-col">
            {steps.map(([label, caption], index) => (
              <li key={label} className="min-w-0 xl:w-full">
                <button
                  type="button"
                  aria-current={step === index ? "step" : undefined}
                  aria-label={`${index + 1}. ${label}`}
                  onClick={() => {
                    if (index <= highest || validate(step)) {
                      setStep(index);
                      setHighest(Math.max(highest, index));
                    }
                  }}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-2 text-left text-sm xl:w-full xl:px-3",
                    step === index && "bg-primary-tint",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-bold",
                      step === index && "border-primary bg-primary",
                      index < step &&
                        "border-foreground bg-inverse text-inverse-foreground",
                    )}
                  >
                    {index < step ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className="hidden xl:block">
                    <span className="block font-bold">{label}</span>
                    <span className="text-xs text-text-secondary">
                      {caption}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-xs leading-relaxed text-text-secondary"
          >
            {draftStatus}
          </p>
        </nav>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          className="min-w-0 space-y-6 rounded-lg bg-background p-4 pb-28 md:p-7"
        >
          {step === 0 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold">Info acara</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Informasi dasar yang tampil di halaman acara.
                </p>
              </div>
              {input("title", "Nama acara", "text", "Maksimal 80 karakter")}
              <Field
                label="Kategori"
                error={form.formState.errors.category?.message}
              >
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Kategori"
                >
                  {categories.map((category) => (
                    <Button
                      type="button"
                      key={category}
                      variant={
                        values.category === category ? "secondary" : "outline"
                      }
                      aria-pressed={values.category === category}
                      onClick={() => {
                        form.setValue("category", category);
                        form.clearErrors("category");
                      }}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </Field>
              {/* Label poster ditampilkan oleh FileUpload sendiri. */}
              <Field
                error={form.formState.errors.posterAssetId?.message}
                helper="Poster tampil di kartu acara dan halaman detail."
              >
                <EventImageUpload
                  label="Poster acara"
                  value={poster}
                  disabled={!online || frozen}
                  onChange={(assetId, url) => {
                    form.setValue("posterAssetId", assetId);
                    setPoster(url);
                    form.clearErrors("posterAssetId");
                  }}
                />
              </Field>
              <Field
                label="Deskripsi"
                htmlFor="description"
                error={form.formState.errors.description?.message}
                helper="Ceritakan suasana, susunan acara, dan hal yang perlu disiapkan peserta."
              >
                <Textarea
                  id="description"
                  rows={5}
                  {...form.register("description")}
                />
              </Field>
            </section>
          )}
          {step === 1 && (
            <section className="space-y-6">
              <h2 className="text-xl font-extrabold">Waktu & tempat</h2>
              <h3 className="font-bold">Jadwal</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {input("startsAt", "Tanggal dan jam mulai", "datetime-local")}
                {input("endsAt", "Tanggal dan jam selesai", "datetime-local")}
              </div>
              <Field label="Zona waktu" htmlFor="timezone">
                <Select
                  value={values.timezone}
                  onValueChange={(value) =>
                    form.setValue(
                      "timezone",
                      value as EditorValues["timezone"],
                      {
                        shouldDirty: true,
                      },
                    )
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Jakarta">WIB (GMT+7)</SelectItem>
                    <SelectItem value="Asia/Makassar">WITA (GMT+8)</SelectItem>
                    <SelectItem value="Asia/Jayapura">WIT (GMT+9)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <h3 className="font-bold">Lokasi</h3>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  Jenis lokasi
                </legend>
                <div className="flex gap-6">
                  {[
                    ["offline", "Luring"],
                    ["online", "Daring"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex min-h-11 items-center gap-2"
                    >
                      <input
                        type="radio"
                        value={value}
                        {...form.register("locationType")}
                        className="size-5 accent-foreground"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {input(
                "venueName",
                values.locationType === "online"
                  ? "Tautan acara"
                  : "Nama tempat",
              )}
              {values.locationType === "offline" && (
                <>
                  <RegionFields
                    value={{ province: values.province, regency: values.city }}
                    onChange={(value) => {
                      form.setValue("province", value.province, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      form.setValue("city", value.regency, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    onBlur={(field) =>
                      form.trigger(field === "province" ? "province" : "city")
                    }
                    errors={{
                      province: form.formState.errors.province?.message,
                      regency: form.formState.errors.city?.message,
                    }}
                  />
                  {input("address", "Alamat lengkap")}
                  {input("postalCode", "Kode pos")}
                  <LocationPreview
                    venueName={values.venueName}
                    address={values.address}
                  />
                </>
              )}
            </section>
          )}
          {step === 2 && (
            <>
              <TicketEditor
                eventId={eventId}
                tickets={tickets}
                startsAt={values.startsAt}
                timezone={values.timezone}
                disabled={!online || frozen}
                onChanged={setTickets}
              />
              <section className="space-y-3 border-t border-border pt-5">
                <h3 className="font-bold">Pengaturan pembelian</h3>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={values.showRemaining}
                    onCheckedChange={(checked) =>
                      form.setValue("showRemaining", checked === true, {
                        shouldDirty: true,
                      })
                    }
                  />
                  <span className="flex flex-col gap-0.5">
                    <span>Tampilkan sisa tiket di halaman acara</span>
                    <span className="text-sm text-text-secondary">
                      Pembeli melihat jumlah tiket yang masih tersedia.
                    </span>
                  </span>
                </label>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>Setiap pesanan berisi maksimal 4 tiket.</li>
                  <li>
                    Pembeli wajib mengisi nama setiap peserta, dan nama itu
                    tercetak di e-tiket.
                  </li>
                </ul>
              </section>
            </>
          )}
          {step === 3 && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold">Ketentuan</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Tampil sebagai daftar poin di halaman acara.
                </p>
              </div>
              <SortableList
                ids={termIds.current}
                onMove={moveTerm}
                itemLabel={(index) => `ketentuan ${index + 1}`}
                disabled={!online || frozen}
              >
                {(index) => (
                  <>
                    <Field
                      label={`Ketentuan ${index + 1}`}
                      reserveMessageSpace
                      htmlFor={`term-${index}`}
                      error={form.formState.errors.terms?.[index]?.message}
                    >
                      <Input
                        id={`term-${index}`}
                        {...form.register(`terms.${index}`)}
                      />
                    </Field>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="mt-[22px] shrink-0"
                      aria-label={`Hapus ketentuan ${index + 1}`}
                      onClick={() => removeTerm(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </SortableList>
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => form.setValue("terms", [...values.terms, ""])}
              >
                <Plus className="size-4" />
                Tambah ketentuan
              </Button>
              <div className="space-y-4 border-t border-border pt-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold">Pengisi acara</h2>
                  <p className="text-sm text-text-secondary">
                    Opsional. Tampilkan siapa saja yang mengisi acara, misalnya
                    pembicara, penampil, atau bintang tamu.
                  </p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={values.showPerformers}
                    onCheckedChange={(checked) =>
                      form.setValue("showPerformers", checked === true, {
                        shouldDirty: true,
                      })
                    }
                  />
                  Tampilkan bagian ini di halaman acara
                </label>
                {values.showPerformers && (
                  <>
                    <Field
                      label="Sebutan"
                      htmlFor="performerLabel"
                      helper="Dipakai sebagai judul bagian ini di halaman acara."
                    >
                      <Select
                        value={values.performerLabel}
                        onValueChange={(value) =>
                          form.setValue("performerLabel", value, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <SelectTrigger id="performerLabel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Penampil",
                            "Pembicara",
                            "Pemateri",
                            "Bintang tamu",
                            "Pengisi acara",
                          ].map((label) => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {values.performers.map((performer, index) => (
                      <div
                        key={index}
                        className="space-y-4 rounded-lg border border-border p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold">
                            {values.performerLabel} {index + 1}
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus ${values.performerLabel} ${index + 1}`}
                            onClick={() =>
                              form.setValue(
                                "performers",
                                values.performers.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <EventImageUpload
                          label={`Foto ${performer.name || values.performerLabel.toLowerCase()} (opsional)`}
                          value={performer.photoUrl}
                          disabled={!online || frozen}
                          onChange={(assetId, url) => {
                            form.setValue(
                              `performers.${index}.photoAssetId`,
                              assetId,
                            );
                            form.setValue(`performers.${index}.photoUrl`, url);
                          }}
                        />
                        <Field
                          label="Nama"
                          htmlFor={`performer-${index}`}
                          error={
                            form.formState.errors.performers?.[index]?.name
                              ?.message
                          }
                        >
                          <Input
                            id={`performer-${index}`}
                            {...form.register(`performers.${index}.name`)}
                          />
                        </Field>
                        <Field
                          label="Keterangan (opsional)"
                          htmlFor={`note-${index}`}
                        >
                          <Input
                            id={`note-${index}`}
                            placeholder="Contoh: Fotografer jalanan, Yogyakarta"
                            {...form.register(`performers.${index}.note`)}
                          />
                        </Field>
                        <Field
                          label="Jam tampil (opsional)"
                          htmlFor={`time-${index}`}
                        >
                          <Input
                            id={`time-${index}`}
                            type="time"
                            className="w-36 [&::-webkit-calendar-picker-indicator]:hidden"
                            {...form.register(`performers.${index}.time`)}
                          />
                        </Field>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full md:w-auto"
                      onClick={() =>
                        form.setValue("performers", [
                          ...values.performers,
                          { name: "", note: "", time: "" },
                        ])
                      }
                    >
                      <Plus className="size-4" />
                      Tambah {values.performerLabel.toLowerCase()}
                    </Button>
                  </>
                )}
              </div>
            </section>
          )}
          {step === 4 && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold">Tinjau acara</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Periksa kembali sebelum acara diterbitkan.
                </p>
              </div>
              {[
                `${values.title}, ${values.category}`,
                `${values.startsAt ? formatEventDateTime(fromLocalInput(values.startsAt, values.timezone), values.timezone) : "Waktu mulai belum diisi"} sampai ${values.endsAt ? formatEventDateTime(fromLocalInput(values.endsAt, values.timezone), values.timezone) : "waktu selesai belum diisi"}, ${values.venueName}`,
                `${tickets.length} jenis tiket, total kuota ${tickets.reduce((total, t) => total + t.capacity, 0)}`,
                `${values.terms.length} ketentuan, ${values.showPerformers ? values.performers.length : 0} ${values.performerLabel.toLowerCase()}`,
              ].map((summary, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 border-b border-border pb-4"
                >
                  <div>
                    <h3 className="font-bold">{steps[index][0]}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {summary}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(index)}
                  >
                    Ubah
                  </Button>
                </div>
              ))}
              <h3 className="font-bold">Pratinjau kartu acara</h3>
              <div className="max-w-sm overflow-hidden rounded-lg border border-border">
                {poster && (
                  <div className="relative aspect-video">
                    <Image
                      src={poster}
                      alt="Poster acara"
                      fill
                      sizes="400px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <p className="font-extrabold">{values.title}</p>
                  <p className="text-sm text-text-secondary">
                    {values.venueName}, {values.city}
                  </p>
                  <p className="font-bold">
                    {tickets.length
                      ? `Mulai ${formatRupiah(Math.min(...tickets.map((t) => t.price)))}`
                      : "Belum ada tiket"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-primary-tint p-4 text-sm leading-relaxed">
                <h3 className="font-bold">Setelah diterbitkan</h3>
                <p className="mt-1">
                  Acara tampil di Jelajahi dan tiket dapat dibeli sesuai jadwal
                  penjualan.
                </p>
              </div>
            </section>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-danger-tint p-3 text-sm text-danger-ink"
            >
              {error}
            </p>
          )}
          <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 items-center gap-2 border-t border-border bg-background px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:static md:flex md:justify-between md:px-0">
            <Button
              type="button"
              variant="ghost"
              className="order-2 w-full md:order-none md:w-auto"
              disabled={!step || busy}
              onClick={() => setStep(step - 1)}
            >
              Kembali
            </Button>
            <div className="contents md:flex md:flex-wrap md:gap-2">
              <Button
                type="button"
                variant="outline"
                className="order-2 w-full md:order-none md:w-auto"
                loading={busy && !confirmation}
                disabled={!isPublished && !dirty}
                onClick={() => {
                  if (isPublished) {
                    if (cache())
                      toast.success("Perubahan disimpan di perangkat");
                  } else void save(true);
                }}
              >
                {isPublished
                  ? "Simpan di perangkat"
                  : !dirty && (savedAt || initial)
                    ? "Tersimpan"
                    : "Simpan draf"}
              </Button>
              {step < 4 ? (
                <Button
                  type="submit"
                  className="order-1 col-span-2 w-full md:order-none md:w-auto"
                >
                  Lanjut
                </Button>
              ) : (
                <Button
                  type="button"
                  className="order-1 col-span-2 w-full md:order-none md:w-auto"
                  disabled={!online || frozen || busy}
                  onClick={() => {
                    if (validate(step, true))
                      setConfirmation(isPublished ? "update" : "publish");
                  }}
                >
                  {isPublished ? "Simpan perubahan" : "Terbitkan acara"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
      <ResponsiveDialog
        open={confirmation !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setConfirmation(null);
        }}
        title={
          confirmation === "publish"
            ? "Terbitkan acara?"
            : "Simpan perubahan acara?"
        }
        description={
          confirmation === "publish"
            ? `${values.title} akan tampil di Jelajahi. Penjualan tiket mengikuti jadwal yang Anda tentukan.`
            : "Perubahan jadwal atau lokasi memerlukan pemberitahuan kepada pemegang tiket."
        }
      >
        {error && (
          <p role="alert" className="text-sm text-danger-ink">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Batal
          </Button>
          <Button loading={busy} onClick={() => void confirm()}>
            {busy
              ? "Menyimpan"
              : confirmation === "publish"
                ? "Terbitkan"
                : "Simpan perubahan"}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import {
  applicationsApi,
  LINK_TYPES,
  ORGANIZER_TYPES,
  type Application,
  type ApplicationInput,
  type LinkType,
  type OrganizerType,
} from "@/modules/applications/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/elements/Alert";
import { FileUpload } from "@/components/elements/FileUpload";
import { Chip } from "@/components/elements/FilterChips";
import { RegionFields } from "@/components/elements/RegionFields";

import { USERNAME_RE, UsernameField, type UsernameState } from "./UsernameField";
import { MAIL, ORGANIZER_HOST } from "@/lib/site";

/**
 * Formulir pengajuan organizer. Pita 13 A2, B, C3, E, F, G.
 * mode "new": semua isian aktif, isian tersimpan di perangkat sambil diisi (H2).
 * mode "fix": hanya bagian yang ditandai tim Gatherly yang bisa diubah, dengan catatannya di bawah label.
 */

const PHONE = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
const MB = 1024 * 1024;
const NEEDS_LEGAL: OrganizerType[] = ["perusahaan", "organisasi_kampus"];
const DRAFT_KEY = "gatherly:organizer-application-draft";

const fileSchema = z.object({ id: z.string(), name: z.string(), size: z.number(), type: z.string(), url: z.string().optional() }).nullable();

const schema = z
  .object({
    organizerName: z.string().trim().min(2, "Nama penyelenggara wajib diisi").max(80),
    organizerType: z.enum(["komunitas", "organisasi_kampus", "perusahaan", "individu"], { message: "Pilih jenis penyelenggara" }),
    province: z.string().min(1, "Pilih provinsi"),
    city: z.string().min(1, "Pilih kota atau kabupaten"),
    street: z.string().trim().min(8, "Alamat lengkap wajib diisi"),
    postalCode: z.string().trim().regex(/^\d{5}$/, "Kode pos terdiri dari 5 angka"),
    description: z.string().trim().min(20, "Deskripsi singkat wajib diisi, minimal 20 karakter").max(300, "Maksimal 300 karakter"),
    links: z.array(z.object({ type: z.enum(["instagram", "tiktok", "youtube", "website", "lainnya"]), url: z.string().trim().min(3, "Isi tautan") })).max(5),
    picName: z.string().trim().min(2, "Nama lengkap wajib diisi"),
    picRole: z.string().trim().min(2, "Jabatan wajib diisi"),
    picEmail: z.string().trim().min(1, "Email wajib diisi").email("Format email belum lengkap, contoh nama@email.com"),
    picPhone: z.string().trim().refine((v) => PHONE.test(v.replace(/[\s-]/g, "")), "Nomor ponsel belum lengkap, contoh 0812 3456 7890"),
    username: z.string().regex(USERNAME_RE, "Gunakan 4 sampai 30 huruf kecil, angka, titik, atau garis bawah"),
    ktp: fileSchema.superRefine((v, ctx) => {
      if (!v) ctx.addIssue({ code: "custom", message: "Foto KTP penanggung jawab wajib diunggah" });
    }),
    legalDocument: fileSchema,
    agree: z.boolean().refine((v) => v, "Centang pernyataan untuk mengirim pengajuan"),
  })
  .refine((v) => !NEEDS_LEGAL.includes(v.organizerType) || !!v.legalDocument, {
    path: ["legalDocument"],
    message: "Dokumen legalitas wajib untuk perusahaan dan organisasi kampus",
  });

export type FormValues = z.infer<typeof schema>;

export function toInput(v: FormValues): ApplicationInput {
  return {
    organizerName: v.organizerName.trim(),
    organizerType: v.organizerType,
    description: v.description.trim(),
    address: { province: v.province, city: v.city, street: v.street.trim(), postalCode: v.postalCode.trim() },
    links: v.links.map((l) => ({ type: l.type as LinkType, url: l.url.trim() })),
    pic: { name: v.picName.trim(), role: v.picRole.trim(), email: v.picEmail.trim(), phone: v.picPhone.replace(/[\s-]/g, "") },
    username: v.username,
    ktp: v.ktp,
    legalDocument: v.legalDocument,
  };
}

function fromApplication(a: Application): FormValues {
  return {
    organizerName: a.organizerName,
    organizerType: a.organizerType,
    province: a.address.province,
    city: a.address.city,
    street: a.address.street,
    postalCode: a.address.postalCode,
    description: a.description,
    links: a.links,
    picName: a.pic.name,
    picRole: a.pic.role,
    picEmail: a.pic.email,
    picPhone: a.pic.phone,
    username: a.username,
    ktp: a.ktp,
    legalDocument: a.legalDocument,
    agree: true,
  };
}

const EMPTY: FormValues = {
  organizerName: "",
  organizerType: undefined as unknown as OrganizerType,
  province: "",
  city: "",
  street: "",
  postalCode: "",
  description: "",
  links: [{ type: "instagram", url: "" }],
  picName: "",
  picRole: "",
  picEmail: "",
  picPhone: "",
  username: "",
  ktp: null,
  legalDocument: null,
  agree: false,
};

/** Bagian form yang sesuai nama flag dari admin. */
type Section = keyof ApplicationInput;

function Card({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border-strong p-5 md:p-7" aria-labelledby={`sec-${n}`}>
      <div className="flex gap-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground" aria-hidden>
          {n}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={`sec-${n}`} className="text-xl font-extrabold">
            {title}
          </h2>
          <p className="text-sm font-medium text-text-secondary">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Catatan admin di bawah bagian yang perlu diperbaiki (C3). */
function FlagNote({ note }: { note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning-tint px-4 py-3 text-warning-ink">
      <span className="text-[13px] font-bold">Catatan tim Gatherly</span>
      <span className="text-sm">{note}</span>
    </div>
  );
}

function countErrors(errors: FieldErrors<FormValues>) {
  let n = 0;
  for (const [key, value] of Object.entries(errors)) {
    if (key === "root" || !value) continue;
    if (key === "links" && Array.isArray(value)) n += value.filter(Boolean).length;
    else n += 1;
  }
  return n;
}

export function ApplicationForm({
  mode,
  application,
  submitting,
  submitLabel,
  onSubmit,
  serverError,
}: {
  mode: "new" | "fix";
  application?: Application;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: FormValues, helpers: { setError: (field: keyof FormValues, message: string) => void; clearDraft: () => void }) => void;
  serverError?: ReactNode;
}) {
  const online = useOnline();
  const flags = new Map((application?.flags ?? []).map((f) => [f.field, f.note]));
  const editable = (s: Section) => mode === "new" || flags.has(s);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const summaryRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: application ? fromApplication(application) : EMPTY,
  });
  const { control, register, handleSubmit, watch, setError, formState, reset, setValue } = form;
  const links = useFieldArray({ control, name: "links" });
  const type = watch("organizerType");
  const description = watch("description") ?? "";

  // Pulihkan dan simpan isian di perangkat (mode daftar baru).
  useEffect(() => {
    if (mode !== "new") return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) reset({ ...EMPTY, ...JSON.parse(saved), agree: false });
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [mode, reset]);
  useEffect(() => {
    if (mode !== "new") return;
    const sub = watch((values) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...values, agree: false }));
      } catch {
        /* abaikan */
      }
    });
    return () => sub.unsubscribe();
  }, [mode, watch]);
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* abaikan */
    }
  }, []);

  const errorCount = countErrors(formState.errors);
  const showSummary = formState.isSubmitted && errorCount > 0;

  const submit = handleSubmit(
    (values) => {
      if (usernameState === "taken" && editable("username")) {
        setError("username", { message: "Username sudah dipakai. Pilih username lain." }, { shouldFocus: true });
        return;
      }
      onSubmit(values, { setError: (field, message) => setError(field, { message }, { shouldFocus: true }), clearDraft });
    },
    () => requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })),
  );

  const legalRequired = NEEDS_LEGAL.includes(type);

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <div ref={summaryRef} className="flex flex-col gap-4 empty:hidden">
        {!online && (
          <Alert tone="offline" title="Anda sedang luring">
            Isian tersimpan di perangkat ini. Pengajuan dapat dikirim setelah koneksi kembali.
          </Alert>
        )}
        {showSummary && (
          <Alert title={`Ada ${errorCount} kolom yang belum diisi`}>Lengkapi kolom bertanda merah, lalu kirim kembali.</Alert>
        )}
        {serverError}
      </div>

      <Card n={1} title="Data penyelenggara" description="Informasi ini tampil di profil penyelenggara setelah disetujui.">
        <div className="flex flex-col gap-3">
          <Field label="Nama penyelenggara" htmlFor="organizerName" error={formState.errors.organizerName?.message}>
            <Input id="organizerName" disabled={!editable("organizerName")} aria-invalid={!!formState.errors.organizerName} {...register("organizerName")} />
          </Field>
          {flags.get("organizerName") && <FlagNote note={flags.get("organizerName")!} />}
        </div>

        <fieldset className="flex flex-col gap-2" disabled={!editable("organizerType")}>
          <legend className="pb-2 text-sm font-semibold">Jenis penyelenggara</legend>
          <Controller
            control={control}
            name="organizerType"
            render={({ field }) => (
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {ORGANIZER_TYPES.map((t) => (
                  <Chip
                    key={t.value}
                    role="radio"
                    aria-checked={field.value === t.value}
                    selected={field.value === t.value}
                    disabled={!editable("organizerType")}
                    onClick={() => field.onChange(t.value)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            )}
          />
          {formState.errors.organizerType && <p className="text-[13px] text-danger-ink">{formState.errors.organizerType.message}</p>}
          {flags.get("organizerType") && <FlagNote note={flags.get("organizerType")!} />}
        </fieldset>

        <Controller
          control={control}
          name="province"
          render={() => (
            <RegionFields
              idPrefix="org"
              value={{ province: watch("province"), regency: watch("city") }}
              onChange={(v) => {
                setValue("province", v.province, { shouldDirty: true, shouldValidate: formState.isSubmitted });
                setValue("city", v.regency, { shouldDirty: true, shouldValidate: formState.isSubmitted });
              }}
              errors={{ province: formState.errors.province?.message, regency: formState.errors.city?.message }}
              disabled={!editable("address")}
            />
          )}
        />
        <Field label="Alamat lengkap" htmlFor="street" error={formState.errors.street?.message}>
          <Input id="street" autoComplete="street-address" disabled={!editable("address")} aria-invalid={!!formState.errors.street} {...register("street")} />
        </Field>
        <Field label="Kode pos" htmlFor="postalCode" error={formState.errors.postalCode?.message} className="md:max-w-[200px]">
          <Input id="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} disabled={!editable("address")} aria-invalid={!!formState.errors.postalCode} {...register("postalCode")} />
        </Field>
        {flags.get("address") && <FlagNote note={flags.get("address")!} />}

        <div className="flex flex-col gap-3">
          <Field
            label="Deskripsi singkat"
            htmlFor="description"
            error={formState.errors.description?.message}
            helper={
              <span className="flex justify-between gap-4">
                <span>Maksimal 300 karakter</span>
                <span className="tabular-nums">{description.length}/300</span>
              </span>
            }
          >
            <Textarea id="description" rows={3} maxLength={300} disabled={!editable("description")} aria-invalid={!!formState.errors.description} {...register("description")} />
          </Field>
          {flags.get("description") && <FlagNote note={flags.get("description")!} />}
        </div>

        <fieldset className="flex flex-col gap-2.5" disabled={!editable("links")}>
          <legend className="pb-2.5 text-sm font-semibold">Tautan media sosial atau situs</legend>
          {links.fields.map((f, i) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <div className="flex gap-2 md:gap-3">
                <Controller
                  control={control}
                  name={`links.${i}.type`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!editable("links")}>
                      <SelectTrigger className="h-12 w-[132px] shrink-0 md:w-[180px]" aria-label={`Jenis tautan ${i + 1}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINK_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  aria-label={`Tautan ${i + 1}`}
                  placeholder="instagram.com/namaakun"
                  inputMode="url"
                  aria-invalid={!!formState.errors.links?.[i]?.url}
                  {...register(`links.${i}.url`)}
                />
                <button
                  type="button"
                  onClick={() => links.remove(i)}
                  aria-label={`Hapus tautan ${i + 1}`}
                  disabled={!editable("links")}
                  className="press flex size-12 shrink-0 items-center justify-center rounded-md text-text-secondary disabled:opacity-40 [@media(hover:hover)]:hover:bg-surface"
                >
                  <Trash2 className="size-[18px]" aria-hidden />
                </button>
              </div>
              {formState.errors.links?.[i]?.url && <p className="text-[13px] text-danger-ink">{formState.errors.links[i]!.url!.message}</p>}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={links.fields.length >= 5 || !editable("links")}
              onClick={() => links.append({ type: "website", url: "" })}
            >
              <Plus className="size-4" aria-hidden />
              Tambah tautan
            </Button>
            <span className="text-[13px] font-medium text-text-tertiary">Maksimal 5 tautan</span>
          </div>
          {flags.get("links") && <FlagNote note={flags.get("links")!} />}
        </fieldset>
      </Card>

      <Card n={2} title="Penanggung jawab" description="Tim Gatherly menghubungi orang ini selama peninjauan.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="picName" error={formState.errors.picName?.message}>
            <Input id="picName" autoComplete="name" disabled={!editable("pic")} aria-invalid={!!formState.errors.picName} {...register("picName")} />
          </Field>
          <Field label="Jabatan" htmlFor="picRole" error={formState.errors.picRole?.message}>
            <Input id="picRole" autoComplete="organization-title" disabled={!editable("pic")} aria-invalid={!!formState.errors.picRole} {...register("picRole")} />
          </Field>
          <Field label="Email" htmlFor="picEmail" helper="Hasil peninjauan dikirim ke email ini." error={formState.errors.picEmail?.message}>
            <Input id="picEmail" type="email" inputMode="email" autoComplete="email" disabled={!editable("pic")} aria-invalid={!!formState.errors.picEmail} {...register("picEmail")} />
          </Field>
          <Field label="Nomor ponsel" htmlFor="picPhone" error={formState.errors.picPhone?.message}>
            <Input id="picPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" disabled={!editable("pic")} aria-invalid={!!formState.errors.picPhone} {...register("picPhone")} />
          </Field>
        </div>
        {flags.get("pic") && <FlagNote note={flags.get("pic")!} />}
      </Card>

      <Card
        n={3}
        title="Akun organizer"
        description={`Username dipakai untuk masuk ke ${ORGANIZER_HOST} dan tidak dapat diubah setelah disetujui.`}
      >
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <UsernameField
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              onStateChange={setUsernameState}
              error={formState.errors.username?.message}
              disabled={!editable("username")}
            />
          )}
        />
        {flags.get("username") && <FlagNote note={flags.get("username")!} />}
      </Card>

      <Card n={4} title="Dokumen" description="Dokumen hanya dilihat tim Gatherly untuk verifikasi.">
        <div className="flex flex-col gap-3">
          <Controller
            control={control}
            name="ktp"
            render={({ field }) => (
              <FileUpload
                id="ktp"
                label="Foto KTP penanggung jawab"
                hint="JPG, PNG, atau PDF, maksimal 1 MB"
                accept={["image/jpeg", "image/png", "application/pdf"]}
                maxImageBytes={1 * MB}
                maxPdfBytes={1 * MB}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                upload={applicationsApi.uploadDocument}
                disabled={!editable("ktp")}
                error={formState.errors.ktp?.message}
              />
            )}
          />
          {flags.get("ktp") && <FlagNote note={flags.get("ktp")!} />}
        </div>
        <div className="flex flex-col gap-3">
          <Controller
            control={control}
            name="legalDocument"
            render={({ field }) => (
              <FileUpload
                id="legalDocument"
                label={legalRequired ? "Dokumen legalitas" : "Dokumen legalitas (opsional)"}
                hint="PDF, maksimal 2 MB. Wajib untuk perusahaan dan organisasi kampus."
                accept={["application/pdf"]}
                maxPdfBytes={2 * MB}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                upload={applicationsApi.uploadDocument}
                disabled={!editable("legalDocument")}
                error={formState.errors.legalDocument?.message}
              />
            )}
          />
          {flags.get("legalDocument") && <FlagNote note={flags.get("legalDocument")!} />}
        </div>
      </Card>

      <div className="flex flex-col gap-5 pt-2">
        {mode === "new" && (
          <Controller
            control={control}
            name="agree"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="agree"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={!!formState.errors.agree}
                    className={cn("mt-0.5", formState.errors.agree && "border-danger")}
                  />
                  <label htmlFor="agree" className="cursor-pointer text-sm leading-relaxed text-text-secondary">
                    Saya menyatakan data yang saya isi benar dan menyetujui{" "}
                    <Link href="/become-organizer#ketentuan" className="font-bold text-foreground underline-offset-4 hover:underline">
                      Ketentuan Penyelenggara Gatherly
                    </Link>
                    .
                  </label>
                </div>
                {formState.errors.agree && <p className="pl-8 text-[13px] text-danger-ink">{formState.errors.agree.message}</p>}
              </div>
            )}
          />
        )}
        <Button type="submit" size="lg" loading={submitting} disabled={!online} className="w-full md:w-fit md:min-w-[220px]">
          {submitting ? "Mengirim…" : submitLabel}
        </Button>
        <p className="text-sm">
          <span className="font-bold">Butuh bantuan?</span>{" "}
          <a href={`mailto:${MAIL.mitra}`} className="text-text-secondary underline-offset-4 hover:underline">
            Hubungi {MAIL.mitra}
          </a>
        </p>
      </div>
    </form>
  );
}

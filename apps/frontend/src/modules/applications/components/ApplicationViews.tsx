"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FilePen, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useMe } from "@/modules/auth/hooks";
import { useOpenApplication, useSubmitApplication, useSubmitApplicationFix } from "@/modules/applications/hooks";
import type { Application, ApplicationInput } from "@/modules/applications/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";

import { ApplicationForm, toInput } from "./ApplicationForm";
import { ORGANIZER_URL } from "@/lib/site";

/** Pengajuan organizer. Pita 13: daftar baru (A, B) dan perbaiki pengajuan (C). */


function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pt-6 pb-24 md:gap-8 md:px-6 md:pt-10 xl:px-0">{children}</div>;
}

function Heading({ sub }: { sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">Pengajuan organizer</h1>
      <p className="text-[15px] font-medium text-text-secondary md:text-base">
        {sub ?? "Ajukan diri Anda untuk menjual tiket di Gatherly. Tim kami meninjau setiap pengajuan paling lambat 3 hari kerja."}
      </p>
    </div>
  );
}

/** Pilihan Daftar baru atau Perbaiki pengajuan (A2). Masing-masing punya alamat sendiri. */
function TypeSwitch({ current }: { current: "new" | "fix" }) {
  const items = [
    { key: "new", href: "/become-organizer", title: "Daftar baru", desc: "Belum pernah mengajukan sebagai organizer.", icon: UserPlus },
    { key: "fix", href: "/become-organizer/fix", title: "Perbaiki pengajuan", desc: "Gunakan nomor pengajuan dari email tim Gatherly.", icon: FilePen },
  ] as const;
  return (
    <div role="radiogroup" aria-label="Jenis pengajuan" className="grid gap-3 md:grid-cols-2 md:gap-4">
      {items.map((it) => {
        const active = current === it.key;
        return (
          <Link
            key={it.key}
            href={it.href}
            role="radio"
            aria-checked={active}
            className={cn(
              "press flex items-center gap-3.5 rounded-xl border p-4 transition-colors md:p-5",
              active ? "border-foreground bg-primary-tint" : "border-border-strong [@media(hover:hover)]:hover:bg-surface",
            )}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", active ? "bg-primary" : "bg-surface-2")} aria-hidden>
              <it.icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-extrabold">{it.title}</span>
              <span className="text-sm font-medium text-text-secondary">{it.desc}</span>
            </span>
            <span
              className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full border", active ? "border-inverse bg-inverse" : "border-border-strong")}
              aria-hidden
            >
              {active && <span className="size-2 rounded-full bg-background" />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Sent({ title, number, email }: { title: string; number: string; email: string }) {
  return (
    <StateView
      illustration="success"
      title={title}
      description={`Nomor pengajuan Anda ${number}. Salinan pengajuan sudah dikirim ke ${email}. Hasil peninjauan dikirim paling lambat 3 hari kerja.`}
      action={
        <Button asChild>
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      }
    />
  );
}

/** Sudah punya akun organizer (H3). */
function AlreadyOrganizer({ email }: { email?: string }) {
  return (
    <StateView
      illustration="success"
      title="Anda sudah terdaftar sebagai organizer"
      description={`${email ? `Email ${email}` : "Akun Anda"} sudah terhubung dengan akun organizer. Kelola acara Anda di ruang organizer.`}
      action={
        <Button asChild>
          <a href={`${ORGANIZER_URL}/login`}>Masuk ke ruang organizer</a>
        </Button>
      }
    />
  );
}

export function BecomeOrganizerView() {
  const me = useMe();
  const submit = useSubmitApplication();
  const [sent, setSent] = useState<{ number: string; email: string } | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  if (me.data?.organizerId) return <AlreadyOrganizer email={me.data.user.email} />;
  if (sent) return <Sent title="Pengajuan terkirim" number={sent.number} email={sent.email} />;

  return (
    <Shell>
      <Heading />
      <TypeSwitch current="new" />
      <ApplicationForm
        mode="new"
        submitting={submit.isPending}
        submitLabel="Kirim pengajuan"
        serverError={
          existing && (
            <Alert
              title="Email ini sudah punya pengajuan"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/become-organizer/fix?number=${existing}`}>Buka pengajuan {existing}</Link>
                </Button>
              }
            >
              Pengajuan {existing} sedang ditinjau. Tunggu hasilnya di email, atau buka pengajuan itu bila diminta perbaikan.
            </Alert>
          )
        }
        onSubmit={(values, { setError, clearDraft }) => {
          setExisting(null);
          submit.mutate(toInput(values), {
            onSuccess: ({ data }) => {
              clearDraft();
              setSent({ number: data.number, email: data.email || values.picEmail });
              window.scrollTo({ top: 0 });
            },
            onError: (e) => {
              const code = e instanceof ApiError ? e.code : "";
              if (code === "APPLICATION_EXISTS") {
                const number = ((e as ApiError).details as { number?: string } | undefined)?.number ?? "";
                setError("picEmail", `Email ini sudah memiliki pengajuan yang sedang ditinjau${number ? ` (${number})` : ""}`);
                if (number) setExisting(number);
              } else if (code === "USERNAME_TAKEN") setError("username", "Username sudah dipakai. Pilih username lain.");
              else if (code === "ALREADY_ORGANIZER") me.refetch();
              else toast.error("Pengajuan gagal dikirim. Data Anda tetap tersimpan, silakan coba lagi.");
            },
          });
        }}
      />
    </Shell>
  );
}

// ---------- Perbaiki pengajuan ----------

const openSchema = z.object({
  number: z.string().trim().regex(/^PNG-\d{4}-\d{4}$/i, "Nomor pengajuan berformat PNG-2609-0042"),
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email belum lengkap, contoh nama@email.com"),
});

function OpenForm({ onOpened }: { onOpened: (a: Application, email: string) => void }) {
  const search = useSearchParams();
  const open = useOpenApplication();
  const [notice, setNotice] = useState<null | { kind: "reviewing" | "expired"; number: string }>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof openSchema>>({
    resolver: zodResolver(openSchema),
    mode: "onBlur",
    defaultValues: { number: search.get("number") ?? "", email: search.get("email") ?? "" },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setNotice(null);
        const number = v.number.trim().toUpperCase();
        open.mutate(
          { number, email: v.email.trim() },
          {
            onSuccess: (a) => onOpened(a, v.email.trim()),
            onError: (e) => {
              const status = e instanceof ApiError ? e.status : 0;
              const code = e instanceof ApiError ? e.code : "";
              if (status === 404) setError("number", { message: "Nomor pengajuan dan email tidak cocok. Periksa kembali email dari tim Gatherly." });
              else if (code === "NOT_NEEDS_FIX") setNotice({ kind: "reviewing", number });
              else if (status === 410 || code === "FIX_EXPIRED") setNotice({ kind: "expired", number });
              else toast.error("Pengajuan gagal dibuka. Periksa koneksi Anda, lalu coba lagi.");
            },
          },
        );
      })}
      className="flex flex-col gap-5 rounded-xl border border-border-strong p-5 md:p-7"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold">Buka pengajuan Anda</h2>
        <p className="text-sm font-medium text-text-secondary">Masukkan nomor pengajuan dan email yang tercantum pada email dari tim Gatherly.</p>
      </div>
      {notice?.kind === "reviewing" && (
        <Alert tone="info" title="Pengajuan sedang ditinjau">
          Pengajuan {notice.number} belum memerlukan perbaikan. Hasil peninjauan akan dikirim ke email Anda.
        </Alert>
      )}
      {notice?.kind === "expired" && (
        <Alert
          tone="warning"
          title="Batas perbaikan sudah lewat"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/become-organizer">Daftar baru</Link>
            </Button>
          }
        >
          Pengajuan {notice.number} ditutup. Silakan ajukan kembali dengan memilih Daftar baru.
        </Alert>
      )}
      <Field label="Nomor pengajuan" htmlFor="appNumber" error={errors.number?.message}>
        <Input id="appNumber" placeholder="PNG-2609-0042" autoCapitalize="characters" aria-invalid={!!errors.number} {...register("number")} />
      </Field>
      <Field label="Email penanggung jawab" htmlFor="appEmail" error={errors.email?.message}>
        <Input id="appEmail" type="email" inputMode="email" autoComplete="email" placeholder="nama@email.com" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Button type="submit" size="lg" loading={open.isPending} className="w-full md:w-fit">
        {open.isPending ? "Membuka…" : "Buka pengajuan"}
      </Button>
    </form>
  );
}

export function FixApplicationView() {
  const me = useMe();
  const submitFix = useSubmitApplicationFix();
  const [app, setApp] = useState<{ data: Application; email: string } | null>(null);
  const [sent, setSent] = useState(false);

  if (me.data?.organizerId) return <AlreadyOrganizer email={me.data.user.email} />;
  if (sent && app) return <Sent title="Perbaikan terkirim" number={app.data.number} email={app.data.pic.email} />;

  if (!app)
    return (
      <Shell>
        <Heading />
        <TypeSwitch current="fix" />
        <OpenForm onOpened={(data, email) => setApp({ data, email })} />
      </Shell>
    );

  const a = app.data;
  const deadline = a.fixDeadline ? format(new Date(a.fixDeadline), "d MMMM yyyy", { locale: localeId }) : null;

  return (
    <Shell>
      <Heading sub={`Nomor pengajuan ${a.number}. Perbaiki bagian yang ditandai, lalu kirim ulang.`} />
      <Alert tone="warning" title={`Ada ${a.flags.length} bagian yang perlu diperbaiki`}>
        Bagian lain sudah sesuai dan tidak perlu diubah. Batas perbaikan 14 hari sejak email dikirim{deadline ? `, yaitu ${deadline}` : ""}.
      </Alert>
      <ApplicationForm
        mode="fix"
        application={a}
        submitting={submitFix.isPending}
        submitLabel="Kirim perbaikan"
        onSubmit={(values, { setError }) => {
          // Dokumen yang ditandai wajib diganti dengan berkas baru (C3 "Unggah ulang foto KTP").
          const docs = { ktp: "Unggah ulang foto KTP", legalDocument: "Unggah ulang dokumen legalitas" } as const;
          for (const field of ["ktp", "legalDocument"] as const) {
            const flagged = a.flags.some((f) => f.field === field);
            if (flagged && (!values[field] || values[field]?.id === a[field]?.id)) {
              setError(field, docs[field]);
              return;
            }
          }
          const full = toInput(values);
          const changed = Object.fromEntries(a.flags.map((f) => [f.field, full[f.field]])) as Partial<ApplicationInput>;
          submitFix.mutate(
            { number: a.number, input: changed },
            {
              onSuccess: () => {
                setSent(true);
                window.scrollTo({ top: 0 });
              },
              onError: (e) => {
                if (e instanceof ApiError && (e.status === 410 || e.code === "FIX_EXPIRED"))
                  toast.error("Batas perbaikan sudah lewat. Silakan ajukan kembali dengan Daftar baru.");
                else toast.error("Perbaikan gagal dikirim. Data Anda tetap tersimpan, silakan coba lagi.");
              },
            },
          );
        }}
      />
    </Shell>
  );
}

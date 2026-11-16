"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, Info, Phone } from "lucide-react";
import { differenceInYears, isValid, parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useLogout, useMe } from "@/modules/auth/hooks";
import { useEvent } from "@/modules/events/hooks";
import { useCreateOrder } from "@/modules/orders/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/elements/Alert";
import { IconInput } from "@/components/elements/IconInput";
import { StateView } from "@/components/elements/StateView";
import { initials } from "@/components/elements/AccountMenu";

import { BirthDateInput } from "./BirthDateInput";
import { CheckoutLayout, CheckoutMobileHeader, CheckoutProgress, ConfirmDialog, OrderSummary } from "./CheckoutChrome";
import { CheckoutSkeleton } from "./OrderStates";

/**
 * Data peserta. Pita 05 A1, B (validasi), E1 dan E2 (meninggalkan halaman).
 * URL: /checkout?event=<slug>&ticket=<ticketTypeId>&qty=<n> (dari tombol Beli tiket di detail acara).
 * Setelah pesanan dibuat, lanjut ke /checkout/<orderId> untuk membayar.
 */

const PHONE = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

function buildSchema(minAge: number | undefined, eventDate: Date) {
  const attendee = z
    .object({
      mine: z.boolean(),
      name: z.string().trim().min(2, "Isi nama lengkap peserta sesuai kartu identitas"),
      email: z.string().trim().min(1, "Isi email peserta").email("Email belum lengkap, contoh nama@email.com"),
      birthDate: z.string(),
    })
    .superRefine((a, ctx) => {
      if (!minAge) return;
      const d = parseISO(a.birthDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.birthDate) || !isValid(d) || d > new Date()) {
        ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Tanggal lahir belum lengkap, contoh 12 / 03 / 2005" });
      } else if (differenceInYears(eventDate, d) < minAge) {
        ctx.addIssue({ code: "custom", path: ["birthDate"], message: `Peserta harus berusia ${minAge} tahun saat acara` });
      }
    });
  return z.object({
    contactPhone: z
      .string()
      .trim()
      .refine((v) => PHONE.test(v.replace(/[\s-]/g, "")), "Nomor WhatsApp belum benar, contoh 0812 3456 7890"),
    attendees: z.array(attendee),
  });
}
type Values = z.infer<ReturnType<typeof buildSchema>>;

function countErrors(errors: FieldErrors<Values>) {
  let n = errors.contactPhone ? 1 : 0;
  const tickets: number[] = [];
  errors.attendees?.forEach?.((e, i) => {
    if (!e) return;
    const k = Object.keys(e).filter((key) => key !== "root" && key !== "ref").length;
    if (k) {
      n += k;
      tickets.push(i + 1);
    }
  });
  return { n, tickets };
}

export function CheckoutAttendees() {
  const search = useSearchParams();
  const router = useRouter();
  const slug = search.get("event") ?? "";
  const ticketId = search.get("ticket") ?? "";
  const qty = Math.max(0, Math.min(10, Number(search.get("qty") ?? 0)));

  const event = useEvent(slug);
  const me = useMe();
  const ticket = event.data?.ticketTypes.find((t) => t.id === ticketId);

  if (!slug || !ticketId || qty < 1) return <MissingSelection />;
  if (event.isPending || me.isPending) return <CheckoutSkeleton />;
  if (event.isError || !event.data || !ticket || ticket.status !== "on_sale" || !me.data) return <MissingSelection slug={slug} />;

  return <AttendeeForm key={`${slug}-${ticketId}-${qty}`} slug={slug} qty={qty} event={event.data} ticket={ticket} me={me.data} router={router} />;
}

function MissingSelection({ slug }: { slug?: string }) {
  return (
    <StateView
      illustration="no-tickets"
      title="Pilihan tiket tidak ditemukan"
      description="Tiket ini sudah tidak dijual atau tautannya tidak lengkap. Pilih tiket lagi dari halaman acara."
      action={
        <Button asChild>
          <Link href={slug ? `/events/${slug}` : "/"}>{slug ? "Kembali ke acara" : "Jelajahi acara"}</Link>
        </Button>
      }
    />
  );
}

type FormProps = {
  slug: string;
  qty: number;
  event: NonNullable<ReturnType<typeof useEvent>["data"]>;
  ticket: NonNullable<ReturnType<typeof useEvent>["data"]>["ticketTypes"][number];
  me: NonNullable<ReturnType<typeof useMe>["data"]>;
  router: ReturnType<typeof useRouter>;
};

function AttendeeForm({ slug, qty, event, ticket, me, router }: FormProps) {
  const online = useOnline();
  const logout = useLogout();
  const create = useCreateOrder();
  /** Satu kunci per percobaan checkout. Dipakai ulang saat mencoba lagi supaya tidak membuat pesanan ganda. */
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitError, setSubmitError] = useState<"quota" | "generic" | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const minAge = event.minAge;

  const schema = useMemo(() => buildSchema(minAge, new Date(event.startsAt)), [minAge, event.startsAt]);
  const blank = { mine: false, name: "", email: "", birthDate: "" };
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      contactPhone: me.user.phone ?? "",
      attendees: Array.from({ length: qty }, (_, i) => (i === 0 ? { ...blank, mine: true, name: me.user.name, email: me.user.email } : blank)),
    },
  });
  const { control, register, handleSubmit, setValue, watch, formState } = form;
  const { fields } = useFieldArray({ control, name: "attendees" });
  const attendees = watch("attendees");
  const dirty = formState.isDirty;
  const { n: errorCount, tickets: errorTickets } = countErrors(formState.errors);
  const showSummaryError = formState.isSubmitted && errorCount > 0;

  // Peringatan bawaan browser saat menutup tab dengan isian yang belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leave = () => (dirty ? setLeaveOpen(true) : router.push(`/events/${slug}`));

  const toggleMine = (index: number) => {
    attendees.forEach((a, i) => {
      if (i === index) {
        const next = !a.mine;
        setValue(`attendees.${i}.mine`, next, { shouldDirty: true });
        if (next) {
          setValue(`attendees.${i}.name`, me.user.name, { shouldDirty: true, shouldValidate: true });
          setValue(`attendees.${i}.email`, me.user.email, { shouldDirty: true, shouldValidate: true });
        }
      } else if (a.mine) {
        setValue(`attendees.${i}.mine`, false, { shouldDirty: true });
      }
    });
  };

  const onSubmit = handleSubmit(
    (values) => {
      setSubmitError(null);
      create.mutate(
        {
          idempotencyKey: idempotencyKey.current,
          input: {
            ticketTypeId: ticket.id,
            quantity: qty,
            contactPhone: values.contactPhone.replace(/[\s-]/g, ""),
            attendees: values.attendees.map((a) => ({ name: a.name.trim(), email: a.email.trim(), birthDate: minAge ? a.birthDate : undefined })),
          },
        },
        {
          onSuccess: ({ data }) => router.replace(`/checkout/${data.id}`),
          onError: (e) => {
            setSubmitError(e instanceof ApiError && (e.code === "INSUFFICIENT_QUOTA" || e.code === "SOLD_OUT") ? "quota" : "generic");
            alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          },
        },
      );
    },
    () => {
      // Gulir ke isian pertama yang salah (baris B2). Fokus diatur react-hook-form.
      requestAnimationFrame(() => {
        document.querySelector("[aria-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
  );

  const total = qty * ticket.price;
  const submitLabel = create.isPending ? "Membuat pesanan…" : "Lanjut ke pembayaran";

  const main = (
    <form id="attendee-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <CheckoutProgress step={2} />
      <button type="button" onClick={leave} className="press hidden w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary md:flex">
        <ArrowLeft className="size-4" aria-hidden />
        Kembali ke acara
      </button>
      <div className="hidden flex-col gap-1.5 md:flex">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Data peserta</h1>
        <p className="text-[15px] text-text-secondary">
          Isi data tiap pemegang tiket. Nama tercetak di e-tiket, dan e-tiket dikirim ke email masing-masing peserta.
        </p>
      </div>

      {/* Mobile: ringkasan singkat acara */}
      <div className="flex flex-col gap-0.5 md:hidden">
        <span className="text-[15px] font-extrabold">{event.title}</span>
        <span className="text-[13px] text-text-secondary">
          {new Date(event.startsAt).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}, {ticket.name} × {qty}
        </span>
      </div>

      <div ref={alertRef} className="flex flex-col gap-4 empty:hidden">
        {!online && (
          <Alert tone="offline" title="Anda sedang luring">
            Menampilkan data yang terakhir dimuat. Pemesanan tiket memerlukan koneksi internet.
          </Alert>
        )}
        {showSummaryError && (
          <Alert title={`Ada ${errorCount} isian yang perlu diperbaiki`}>
            {errorTickets.length ? `Periksa data Tiket ${errorTickets.join(", ")} di bawah.` : "Periksa kontak pemesan di bawah."}
          </Alert>
        )}
        {submitError === "quota" && (
          <Alert
            title="Sisa tiket tidak cukup"
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/events/${slug}`}>Pilih ulang tiket</Link>
              </Button>
            }
          >
            Tiket {ticket.name} baru saja dibeli orang lain. Pilih jumlah atau jenis tiket lain.
          </Alert>
        )}
        {submitError === "generic" && <Alert title="Pesanan gagal dibuat">Periksa koneksi internet Anda, lalu coba lagi. Isian Anda tetap tersimpan.</Alert>}
      </div>

      {/* Kontak pemesan */}
      <section className="flex flex-col gap-4 rounded-lg border border-border-strong p-5 md:p-6">
        <h2 className="text-[17px] font-extrabold">Kontak pemesan</h2>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-extrabold text-primary-ink">
            {initials(me.user.name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-bold">{me.user.name}</span>
            <span className="truncate text-[13px] text-text-tertiary">{me.user.email}</span>
          </span>
          <button
            type="button"
            className="press shrink-0 text-sm font-bold underline-offset-4 [@media(hover:hover)]:hover:underline"
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.push(`/login?returnTo=${encodeURIComponent(`/checkout?${search(slug, ticket.id, qty)}`)}`),
              })
            }
          >
            Ganti akun
          </button>
        </div>
        <Field label="Nomor WhatsApp" htmlFor="contactPhone" helper="Hanya untuk info penting tentang pesanan Anda." error={formState.errors.contactPhone?.message}>
          <IconInput
            id="contactPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            leading={<Phone />}
            placeholder="0812 3456 7890"
            aria-invalid={!!formState.errors.contactPhone}
            {...register("contactPhone")}
          />
        </Field>
      </section>

      {minAge ? (
        <p className="flex items-center gap-2.5 rounded-md bg-info-tint px-4 py-3 text-sm font-semibold text-info-ink">
          <Info className="size-[18px] shrink-0" aria-hidden />
          <span className="md:hidden">Khusus {minAge}+, tanggal lahir dicek saat masuk.</span>
          <span className="hidden md:inline">Acara ini khusus {minAge} tahun ke atas, tanggal lahir tiap peserta dicek saat masuk.</span>
        </p>
      ) : null}

      {fields.map((field, i) => {
        const err = formState.errors.attendees?.[i];
        const mine = attendees[i]?.mine;
        return (
          <section key={field.id} className="flex flex-col gap-4 rounded-lg border border-border-strong p-5 md:p-6" aria-labelledby={`ticket-${i}`}>
            <div className="flex items-center gap-2.5">
              <h2 id={`ticket-${i}`} className="text-[17px] font-extrabold">
                Tiket {i + 1}
              </h2>
              <Badge>{ticket.name}</Badge>
            </div>
            <label className="press flex w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" checked={!!mine} onChange={() => toggleMine(i)} className="peer sr-only" />
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-[6px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-2",
                  mine ? "border-inverse bg-inverse text-inverse-foreground" : "border-border-strong",
                )}
                aria-hidden
              >
                {mine && <Check className="size-3.5" />}
              </span>
              <span className={mine ? "" : "text-text-secondary"}>Ini tiketku</span>
            </label>
            <Field
              label="Nama lengkap"
              htmlFor={`a${i}-name`}
              helper="Gunakan nama sesuai identitas, panitia bisa mencocokkan saat masuk."
              error={err?.name?.message}
            >
              <Input
                id={`a${i}-name`}
                autoComplete={mine ? "name" : "off"}
                placeholder="Nama sesuai kartu identitas"
                aria-invalid={!!err?.name}
                {...register(`attendees.${i}.name`)}
              />
            </Field>
            <div className={cn("grid gap-4", minAge && "md:grid-cols-2")}>
              <Field label="Email" htmlFor={`a${i}-email`} helper={mine ? undefined : "E-tiket dikirim langsung ke email ini."} error={err?.email?.message}>
                <Input
                  id={`a${i}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete={mine ? "email" : "off"}
                  placeholder="email@contoh.com"
                  aria-invalid={!!err?.email}
                  {...register(`attendees.${i}.email`)}
                />
              </Field>
              {minAge ? (
                <Field label="Tanggal lahir" htmlFor={`a${i}-birth`} error={err?.birthDate?.message}>
                  <Controller
                    control={control}
                    name={`attendees.${i}.birthDate`}
                    render={({ field: f }) => (
                      <BirthDateInput id={`a${i}-birth`} value={f.value} onChange={f.onChange} onBlur={f.onBlur} invalid={!!err?.birthDate} />
                    )}
                  />
                </Field>
              ) : null}
            </div>
          </section>
        );
      })}
    </form>
  );

  const summary = (
    <OrderSummary
      title={event.title}
      poster={event.poster}
      startsAt={event.startsAt}
      venue={`${event.venueName}, ${event.city}`}
      ticketName={ticket.name}
      quantity={qty}
      unitPrice={ticket.price}
    />
  );

  return (
    <>
      <CheckoutLayout
        header={<CheckoutMobileHeader title="Data peserta" step={2} onBack={leave} />}
        main={main}
        side={
          <>
            {summary}
            <Button form="attendee-form" type="submit" size="lg" block loading={create.isPending} disabled={!online}>
              {submitLabel}
            </Button>
            <p className="flex gap-2 px-1 text-[13px] text-text-tertiary">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Setelah ini, tiket Anda ditahan selama 15 menit sambil Anda membayar.
            </p>
          </>
        }
        bottomBar={
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-text-secondary">Total untuk {qty} tiket</span>
              <span className="text-xl font-extrabold">{formatRupiah(total)}</span>
            </div>
            <Button form="attendee-form" type="submit" size="lg" block loading={create.isPending} disabled={!online}>
              {submitLabel}
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Tinggalkan halaman ini?"
        description="Data peserta yang sudah Anda isi akan hilang. Tiket belum dipesan."
        cancelLabel="Tetap di sini"
        confirmLabel="Tinggalkan"
        onConfirm={() => router.push(`/events/${slug}`)}
      />
    </>
  );
}

function search(slug: string, ticket: string, qty: number) {
  return new URLSearchParams({ event: slug, ticket, qty: String(qty) }).toString();
}

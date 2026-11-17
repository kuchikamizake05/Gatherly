"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useApplicationReview,
  useApproveApplication,
  useRejectApplication,
  useRequestFix,
} from "@/modules/admin/hooks";
import type { FieldFlag } from "@/modules/applications/api";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { StateView } from "@/components/elements/StateView";
import { Alert } from "@/components/elements/Alert";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { DocumentViewer } from "@/components/elements/DocumentViewer";
import { FileRow, formatBytes } from "@/components/elements/FileUpload";
import { AdminCard, AdminPage, AdminQueryState } from "./AdminPage";
import { useOnline } from "@/hooks/use-online";
import { formatDateShort } from "@/lib/format";

const schema = z.object({
  notes: z.record(
    z.string(),
    z
      .string()
      .trim()
      .min(1, "Tuliskan perbaikan yang diperlukan.")
      .max(2000, "Catatan maksimal 2.000 karakter."),
  ),
  reason: z.string().max(2000, "Alasan maksimal 2.000 karakter."),
});
type Values = z.infer<typeof schema>;
type Document = { name: string; url: string; type: string };

export function ApplicationReview({ id }: { id: string }) {
  const query = useApplicationReview(id);
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const requestFix = useRequestFix();
  const online = useOnline();
  const [flagged, setFlagged] = useState<FieldFlag["field"][]>([]);
  const [action, setAction] = useState<"approve" | "reject" | "fix" | null>(
    null,
  );
  const [document, setDocument] = useState<Document | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    watch,
    unregister,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { notes: {}, reason: "" },
  });
  const notes = watch("notes");
  const reason = watch("reason");
  const validNotes =
    flagged.length > 0 &&
    flagged.every((field) => {
      const note = notes[field]?.trim();
      return !!note && note.length <= 2000;
    });
  const validReason = reason.trim().length > 0 && reason.trim().length <= 2000;
  const busy = approve.isPending || reject.isPending || requestFix.isPending;
  if (!online || query.isPending || query.isError || !query.data)
    return (
      <AdminQueryState query={query} label="Pengajuan" back="/applications" />
    );
  const data = query.data;
  const terminal =
    data.status === "approved"
      ? "Pengajuan disetujui"
      : data.status === "rejected"
        ? "Pengajuan ditolak"
        : data.status === "needs_fix"
          ? "Menunggu perbaikan"
          : "";
  if (result || terminal)
    return (
      <StateView
        illustration={data.status === "needs_fix" ? "waiting" : "success"}
        title={result || terminal}
        description={data.rejectionReason || data.organizerName}
        action={
          <Button asChild>
            <Link href="/applications">Kembali ke pengajuan</Link>
          </Button>
        }
      />
    );
  const fields: { key: FieldFlag["field"]; label: string; value: string }[] = [
    {
      key: "organizerName",
      label: "Nama organizer",
      value: data.organizerName,
    },
    {
      key: "organizerType",
      label: "Jenis organizer",
      value: data.organizerType.replaceAll("_", " "),
    },
    { key: "description", label: "Deskripsi", value: data.description },
    {
      key: "address",
      label: "Alamat",
      value: `${data.address.street}, ${data.address.city}, ${data.address.province} ${data.address.postalCode}`,
    },
    {
      key: "links",
      label: "Tautan",
      value: data.links.map((link) => link.url).join(", "),
    },
    {
      key: "pic",
      label: "Penanggung jawab",
      value: `${data.pic.name}, ${data.pic.role}, ${data.pic.email}, ${data.pic.phone}`,
    },
    { key: "username", label: "Username", value: data.username },
    {
      key: "ktp",
      label: "Identitas penanggung jawab",
      value: data.ktp?.name ?? "Belum ada dokumen",
    },
    {
      key: "legalDocument",
      label: "Dokumen legalitas",
      value:
        data.legalDocument?.name ??
        "Tidak diwajibkan untuk jenis organizer ini",
    },
  ];
  async function confirm() {
    if (!online || busy) return;
    if (
      (action === "fix" && !validNotes) ||
      (action === "reject" && !validReason)
    )
      return;
    setError("");
    try {
      if (action === "approve") {
        await approve.mutateAsync(id);
        setResult("Pengajuan disetujui");
      } else if (action === "reject") {
        await reject.mutateAsync({ id, reason: reason.trim() });
        setResult("Pengajuan ditolak");
      } else {
        await requestFix.mutateAsync({
          id,
          flags: flagged.map((field) => ({ field, note: notes[field].trim() })),
        });
        setResult("Menunggu perbaikan");
      }
      setAction(null);
    } catch (error) {
      setError(
        error instanceof ApiError && error.code === "ALREADY_REVIEWED"
          ? "Pengajuan sudah ditinjau admin lain. Muat ulang untuk melihat status terbaru."
          : error instanceof ApiError && error.code === "USERNAME_TAKEN"
            ? "Username sudah dipakai. Tandai username untuk diperbaiki."
            : "Tindakan gagal. Periksa koneksi Anda lalu coba lagi.",
      );
    }
  }
  return (
    <AdminPage
      title={data.organizerName}
      description={`${data.number}, masuk ${formatDateShort(data.submittedAt)}`}
    >
      <Link
        href="/applications"
        className="flex min-h-11 items-center text-sm font-bold"
      >
        Kembali ke pengajuan
      </Link>
      {!data.checks.usernameAvailable && (
        <Alert title="Username sudah dipakai">
          Tandai username untuk diperbaiki sebelum menyetujui pengajuan.
        </Alert>
      )}
      {error && !action && <Alert title={error} />}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <AdminCard title="Informasi pengajuan">
          <div className="divide-y divide-border">
            {fields.map((field) => (
              <div key={field.key} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold">{field.label}</h2>
                    {data.previousValues?.[field.key] && (
                      <div className="my-2">
                        <Badge>Diperbarui</Badge>
                        <p className="mt-1 text-xs text-text-secondary">
                          Sebelumnya: {data.previousValues[field.key]}
                        </p>
                      </div>
                    )}
                    <p className="mt-2 break-words text-sm leading-relaxed text-text-secondary">
                      {field.value}
                    </p>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-xs">
                    <Checkbox
                      checked={flagged.includes(field.key)}
                      onCheckedChange={(checked) => {
                        setFlagged((previous) =>
                          checked
                            ? [...previous, field.key]
                            : previous.filter((key) => key !== field.key),
                        );
                        if (!checked) unregister(`notes.${field.key}`);
                      }}
                    />
                    Perlu perbaikan
                    <span className="sr-only"> {field.label}</span>
                  </label>
                </div>
                {flagged.includes(field.key) && (
                  <Field
                    className="mt-3"
                    label={`Catatan perbaikan ${field.label}`}
                    htmlFor={`note-${field.key}`}
                    error={errors.notes?.[field.key]?.message}
                  >
                    <Textarea
                      id={`note-${field.key}`}
                      aria-invalid={!!errors.notes?.[field.key]}
                      {...register(`notes.${field.key}`)}
                    />
                  </Field>
                )}
                {data.documents
                  .filter(
                    (doc) =>
                      field.key ===
                      (doc.kind === "ktp" ? "ktp" : "legalDocument"),
                  )
                  .map((doc) => (
                    <div key={doc.kind} className="mt-3">
                      <FileRow
                        name={doc.fileName}
                        note={`${formatBytes(doc.size)}, ${formatDateShort(doc.uploadedAt)}`}
                        isPdf={doc.kind === "legal"}
                        action={
                          <Button
                            variant="outline"
                            aria-label={`Lihat dokumen ${doc.fileName}`}
                            onClick={() => {
                              setDocument({
                                name: doc.fileName,
                                url: doc.url,
                                type: doc.fileName.endsWith(".pdf")
                                  ? "application/pdf"
                                  : "image/svg+xml",
                              });
                            }}
                          >
                            Lihat
                          </Button>
                        }
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </AdminCard>
        <div className="space-y-6">
          <AdminCard title="Pemeriksaan">
            <ul className="space-y-3 text-sm">
              <li>
                Email{" "}
                {data.checks.emailVerified
                  ? "terverifikasi"
                  : "belum terverifikasi"}
              </li>
              <li>
                Username{" "}
                {data.checks.usernameAvailable ? "tersedia" : "sudah dipakai"}
              </li>
              <li>
                {data.checks.similarOrganizers} organizer dengan nama serupa
              </li>
            </ul>
          </AdminCard>
          <AdminCard title="Riwayat">
            {data.history.map((item, index) => (
              <p key={index} className="mb-3 text-sm">
                {item.action}
                <span className="mt-1 block text-xs text-text-secondary">
                  {item.by}, {formatDateShort(item.at)}
                </span>
              </p>
            ))}
          </AdminCard>
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-border bg-background py-4">
        <Button
          disabled={
            busy || flagged.length > 0 || !data.checks.usernameAvailable
          }
          onClick={() => {
            setError("");
            setAction("approve");
          }}
        >
          Setujui pengajuan
        </Button>
        <Button
          variant="outline"
          disabled={busy || !flagged.length || !validNotes}
          onClick={() => {
            setError("");
            setAction("fix");
          }}
        >
          Minta perbaikan
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setError("");
            setAction("reject");
          }}
        >
          Tolak pengajuan
        </Button>
      </div>
      <DangerConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          action === "approve"
            ? "Setujui pengajuan?"
            : action === "reject"
              ? "Tolak pengajuan?"
              : "Kirim permintaan perbaikan?"
        }
        description={
          action === "fix"
            ? `${flagged.length} isian ditandai. Organizer akan menerima catatan perbaikan.`
            : data.organizerName
        }
        confirmLabel={
          action === "approve"
            ? "Setujui pengajuan"
            : action === "reject"
              ? "Tolak pengajuan"
              : "Kirim permintaan"
        }
        confirmVariant={action === "reject" ? "dangerSolid" : "primary"}
        canConfirm={
          action === "reject"
            ? validReason
            : action === "fix"
              ? validNotes
              : true
        }
        loading={busy}
        error={error}
        onConfirm={() => void confirm()}
      >
        {action === "reject" && (
          <Field
            label="Alasan penolakan"
            htmlFor="rejection-reason"
            error={errors.reason?.message}
          >
            <Textarea id="rejection-reason" {...register("reason")} />
          </Field>
        )}
      </DangerConfirmDialog>
      <DocumentViewer
        open={!!document}
        onOpenChange={(open) => {
          if (!open) setDocument(null);
        }}
        file={document}
        caption="Dokumen pengajuan organizer"
        footer="Data pribadi hanya untuk verifikasi dan tidak dibagikan."
      />
    </AdminPage>
  );
}

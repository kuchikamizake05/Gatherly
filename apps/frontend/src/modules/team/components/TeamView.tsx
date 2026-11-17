"use client";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/elements/DataList";
import { QueryState } from "@/components/elements/QueryState";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Alert } from "@/components/elements/Alert";
import { useOnline } from "@/hooks/use-online";
import { useDebounced } from "@/hooks/use-debounced";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useOrgEvents } from "@/modules/organizer-events/hooks";
import { teamApi, type TeamMember, type Credentials } from "../api";
import { useTeam, useMemberUsernameCheck } from "../hooks";
import { formatDateLong } from "@/lib/format";

const schema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  username: z
    .string()
    .regex(
      /^[a-z0-9._]{3,30}$/,
      "Gunakan 3–30 huruf kecil, angka, titik, atau garis bawah",
    ),
  email: z.union([
    z.literal(""),
    z.string().email("Format email belum lengkap"),
  ]),
  eventIds: z.array(z.string()),
});
const statusLabel = {
  owner: "Pemilik",
  active: "Aktif",
  never_logged_in: "Belum masuk",
  inactive: "Nonaktif",
};
type Action = "reset" | "assign" | "deactivate" | "reactivate" | "remove";
export function TeamView() {
  const team = useTeam();
  const events = useOrgEvents();
  const me = useWorkspaceMe();
  const online = useOnline();
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [action, setAction] = useState<{
    type: Action;
    member: TeamMember;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    watch,
    handleSubmit,
    reset,
    setError: fieldError,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { name: "", username: "", email: "", eventIds: [] },
  });
  const username = useDebounced(watch("username"));
  const check = useMemberUsernameCheck(username);
  const disabled = !online || !!me.data?.organizer.frozen;
  const eligible =
    events.data?.data.filter(
      (e) => e.status !== "ended" && e.status !== "cancelled",
    ) ?? [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["org"] });
  };
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      refresh();
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  const actions = (member: TeamMember) =>
    member.status === "owner" ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || busy}
            aria-label={`Tindakan ${member.name}`}
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(member.status === "inactive"
            ? [
                ["reactivate", "Aktifkan"],
                ["remove", "Hapus"],
              ]
            : [
                ["assign", "Penugasan"],
                ["reset", "Reset password"],
                ["deactivate", "Nonaktifkan"],
              ]
          ).map(([type, label]) => (
            <DropdownMenuItem
              key={type}
              onSelect={() => {
                setError("");
                setSelected(
                  member.eventIds ??
                    (member.assignedEvents > 0
                      ? eligible
                          .slice(0, member.assignedEvents)
                          .map((e) => e.id)
                      : []),
                );
                setAction({ type: type as Action, member });
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  const picker = (
    <div className="space-y-2">
      {events.isPending ? (
        <p>Memuat acara…</p>
      ) : events.isError ? (
        <Alert
          title="Acara belum dimuat"
          action={
            <Button variant="outline" onClick={() => events.refetch()}>
              Coba lagi
            </Button>
          }
        >
          {events.error.message}
        </Alert>
      ) : eligible.length ? (
        eligible.map((event) => (
          <label
            key={event.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-5 accent-foreground"
              checked={selected.includes(event.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, event.id]
                    : ids.filter((id) => id !== event.id),
                )
              }
            />
            {event.title}
          </label>
        ))
      ) : (
        <p className="text-sm text-text-secondary">
          Belum ada acara yang dapat ditugaskan.
        </p>
      )}
    </div>
  );
  if (team.isPending || team.isError)
    return (
      <QueryState
        loading={team.isPending}
        error={team.error}
        retry={team.refetch}
      />
    );
  return (
    <section className="flex flex-col gap-5 rounded-lg bg-background p-4 has-[[data-state-view]]:flex-1 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">Anggota tim</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {team.data.length - 1} dari 20 akun panitia. Akses hanya untuk acara
            yang ditugaskan.
          </p>
        </div>
        <Button
          disabled={disabled || team.data.length - 1 >= 20}
          onClick={() => {
            reset();
            setSelected([]);
            setError("");
            setCreate(true);
          }}
        >
          Tambah anggota
        </Button>
      </div>
      <DataList
        rows={team.data}
        rowKey={(m) => m.id}
        columns={[
          {
            key: "name",
            title: "Anggota",
            render: (m) => (
              <div className="space-y-1">
                <p className="font-bold">{m.name}</p>
                <p className="text-text-secondary">@{m.username}</p>
              </div>
            ),
          },
          {
            key: "events",
            title: "Penugasan",
            render: (m) =>
              m.status === "owner"
                ? "Semua acara"
                : `${m.assignedEvents} acara`,
          },
          {
            key: "status",
            title: "Status",
            render: (m) => (
              <Badge tone="neutral">{statusLabel[m.status]}</Badge>
            ),
          },
          { key: "actions", title: "Tindakan", render: actions },
        ]}
        mobile={(m) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{m.name}</p>
                <p className="text-sm text-text-secondary">@{m.username}</p>
              </div>
              <Badge tone="neutral">{statusLabel[m.status]}</Badge>
            </div>
            <p className="text-sm">
              {m.status === "owner"
                ? "Semua acara"
                : `${m.assignedEvents} acara`}
            </p>
            {actions(m)}
          </div>
        )}
      />
      <ResponsiveDialog
        open={create}
        onOpenChange={(value) => !busy && setCreate(value)}
        title="Tambah anggota"
        description="Kredensial sementara akan ditampilkan sekali setelah akun dibuat."
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            if (
              check.data?.available === false &&
              username === values.username
            ) {
              fieldError(
                "username",
                { message: "Username sudah digunakan" },
                { shouldFocus: true },
              );
              return;
            }
            await run(async () => {
              const result = await teamApi.create({
                ...values,
                eventIds: selected,
                email: values.email || undefined,
              });
              setCreate(false);
              setCredentials(result.data);
            });
          })}
        >
          {error && <Alert title="Akun belum dibuat">{error}</Alert>}
          <Field
            label="Nama lengkap"
            htmlFor="member-name"
            error={errors.name?.message}
          >
            <Input id="member-name" {...register("name")} />
          </Field>
          <Field
            label="Username"
            htmlFor="member-username"
            error={
              errors.username?.message ||
              (check.data?.available === false
                ? "Username sudah digunakan"
                : undefined)
            }
            helper={
              check.data?.available && username
                ? "Username tersedia"
                : "3–30 huruf kecil, angka, titik, atau garis bawah"
            }
          >
            <Input
              id="member-username"
              autoComplete="off"
              {...register("username")}
            />
          </Field>
          <Field
            label="Email (opsional)"
            htmlFor="member-email"
            error={errors.email?.message}
          >
            <Input id="member-email" type="email" {...register("email")} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-bold">Penugasan acara</legend>
            {picker}
          </fieldset>
          <Button
            type="submit"
            className="w-full"
            disabled={disabled || busy || events.isError || events.isPending}
          >
            {busy ? "Membuat…" : "Buat akun panitia"}
          </Button>
        </form>
      </ResponsiveDialog>
      <ResponsiveDialog
        open={action?.type === "assign"}
        onOpenChange={(open) => !open && !busy && setAction(null)}
        title="Atur penugasan"
        description={`Pilih acara untuk ${action?.member.name ?? "anggota"}.`}
      >
        {error && <Alert title="Penugasan belum tersimpan">{error}</Alert>}
        {picker}
        <Button
          disabled={busy || disabled || events.isPending || events.isError}
          onClick={() =>
            action &&
            run(() => teamApi.setAssignments(action.member.id, selected))
          }
        >
          Simpan penugasan
        </Button>
      </ResponsiveDialog>
      <DangerConfirmDialog
        open={!!action && action.type !== "assign"}
        onOpenChange={(open) => !open && !busy && setAction(null)}
        title={
          action?.type === "reset"
            ? "Reset password anggota?"
            : action?.type === "deactivate"
              ? "Nonaktifkan anggota?"
              : action?.type === "remove"
                ? "Hapus akun anggota?"
                : "Aktifkan kembali anggota?"
        }
        description={
          action?.type === "reset"
            ? "Password baru berlaku 7 hari. Sesi anggota di perangkat lain akan diakhiri."
            : action?.type === "deactivate"
              ? "Akses dan penugasan dicabut. Riwayat check-in tetap tersimpan."
              : action?.type === "remove"
                ? "Akun yang nonaktif akan dihapus. Riwayat check-in tetap tersimpan."
                : "Anggota dapat masuk kembali. Atur penugasan acara setelah aktivasi."
        }
        confirmLabel="Lanjutkan"
        loading={busy}
        canConfirm={!disabled}
        error={error}
        onConfirm={() =>
          action &&
          run(async () => {
            if (action.type === "reset")
              setCredentials(
                (await teamApi.resetPassword(action.member.id)).data,
              );
            else if (action.type === "deactivate")
              await teamApi.deactivate(action.member.id);
            else if (action.type === "reactivate")
              await teamApi.reactivate(action.member.id);
            else if (action.type === "remove")
              await teamApi.remove(action.member.id);
          })
        }
      />
      <ResponsiveDialog
        open={!!credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
        title="Simpan kredensial anggota"
        description="Password hanya ditampilkan sekali. Bagikan melalui saluran yang aman."
      >
        {credentials && (
          <>
            <dl className="space-y-3 rounded-md bg-muted p-4 text-sm">
              <div>
                <dt>Username</dt>
                <dd className="mt-1 font-bold">{credentials.username}</dd>
              </div>
              <div>
                <dt>Password sementara</dt>
                <dd className="mt-1 break-all font-mono font-bold">
                  {credentials.temporaryPassword}
                </dd>
              </div>
              <div>
                <dt>Berlaku hingga</dt>
                <dd>{formatDateLong(credentials.expiresAt)}</dd>
              </div>
            </dl>
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Username: ${credentials.username}\nPassword sementara: ${credentials.temporaryPassword}`,
                  );
                  toast.success("Kredensial disalin");
                } catch {
                  toast.error(
                    "Tidak dapat menyalin. Salin kredensial secara manual.",
                  );
                }
              }}
            >
              Salin kredensial
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCredentials(null)}
            >
              Saya sudah menyimpannya
            </Button>
          </>
        )}
      </ResponsiveDialog>
    </section>
  );
}

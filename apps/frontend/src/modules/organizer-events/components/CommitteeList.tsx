"use client";

import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTeam } from "@/modules/team/hooks";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useOnline } from "@/hooks/use-online";
import {
  useEventCommittee,
  useAssignCommittee,
  useRevokeCommittee,
} from "../hooks";
import type { CommitteeAssignment } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/elements/DataList";
import { QueryState } from "@/components/elements/QueryState";
import { StateView } from "@/components/elements/StateView";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { formatDateShort } from "@/lib/format";

export function CommitteeList({ eventId }: { eventId: string }) {
  const committee = useEventCommittee(eventId);
  const team = useTeam();
  const me = useWorkspaceMe();
  const online = useOnline();
  const assign = useAssignCommittee(eventId);
  const revoke = useRevokeCommittee(eventId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState<CommitteeAssignment | null>(null);
  const [error, setError] = useState("");
  const busy = assign.isPending || revoke.isPending;
  const disabled = !online || !!me.data?.organizer.frozen;
  if (committee.isPending || committee.isError)
    return (
      <QueryState
        loading={committee.isPending}
        error={committee.error}
        retry={committee.refetch}
      />
    );
  const rows = committee.data;
  const actions = (row: CommitteeAssignment) => (
    <Button
      variant="danger"
      disabled={disabled || busy}
      onClick={() => {
        setError("");
        setRemoving(row);
      }}
    >
      Cabut penugasan
    </Button>
  );
  return (
    <section className="flex flex-1 flex-col gap-5 rounded-lg bg-background p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">Panitia yang ditugaskan</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Panitia hanya dapat memindai tiket acara yang ditugaskan.
          </p>
        </div>
        {rows.length > 0 && (
          <Button
            disabled={disabled}
            onClick={() => {
              setSelected([]);
              setError("");
              setOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            Tugaskan panitia
          </Button>
        )}
      </div>
      {rows.length ? (
        <DataList
          rows={rows}
          rowKey={(row) => row.userId}
          columns={[
            {
              key: "name",
              title: "Nama",
              render: (row) => (
                <div>
                  <p className="font-bold">{row.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {row.username ? `@${row.username}` : "Akun panitia"}
                    {row.assignedAt
                      ? `, ditugaskan ${formatDateShort(row.assignedAt)}`
                      : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "access",
              title: "Akses",
              render: () => <Badge tone="info">Pemindai</Badge>,
            },
            { key: "actions", title: "Tindakan", render: actions },
          ]}
          mobile={(row) => (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <strong>{row.name}</strong>
                <Badge tone="info">Pemindai</Badge>
              </div>
              <p className="text-sm text-text-secondary">@{row.username}</p>
              {actions(row)}
            </div>
          )}
        />
      ) : (
        <StateView
          illustration="no-events"
          title="Belum ada panitia yang ditugaskan"
          description="Tugaskan anggota tim untuk membantu pemindaian tiket di pintu masuk."
          action={
            <Button
              disabled={disabled}
              onClick={() => {
                setSelected([]);
                setError("");
                setOpen(true);
              }}
            >
              Tugaskan panitia
            </Button>
          }
        />
      )}
      <ResponsiveDialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title="Tugaskan panitia"
        form
        description="Pilih anggota tim yang akan memindai tiket acara ini."
      >
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {team.isPending || team.isError ? (
            <QueryState
              loading={team.isPending}
              error={team.error}
              retry={team.refetch}
            />
          ) : (
            team.data
              ?.filter((m) => m.status !== "owner")
              .map((member) => {
                const assigned = rows.some((row) => row.userId === member.id);
                const inactive = member.status === "inactive";
                return (
                  <label
                    key={member.id}
                    className={`flex min-h-16 items-center gap-3 rounded-md border border-border p-3 ${assigned || inactive ? "text-text-disabled" : ""}`}
                  >
                    <Checkbox
                      disabled={assigned || inactive || busy}
                      checked={assigned || selected.includes(member.id)}
                      onCheckedChange={(checked) =>
                        setSelected((list) =>
                          checked === true
                            ? [...list, member.id]
                            : list.filter((id) => id !== member.id),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">
                        {member.name}
                      </span>
                      <span className="text-xs">
                        @{member.username}
                        {assigned
                          ? ", sudah ditugaskan"
                          : inactive
                            ? ", nonaktif"
                            : ""}
                      </span>
                    </span>
                  </label>
                );
              })
          )}
        </div>
        <p className="text-sm text-text-secondary">
          Belum ada anggota yang sesuai?{" "}
          <Link href="/settings/team" className="font-semibold underline">
            Tambahkan di Pengaturan, Tim.
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-ink">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            disabled={!selected.length || disabled}
            loading={assign.isPending}
            onClick={async () => {
              try {
                await assign.mutateAsync(selected);
                setOpen(false);
                toast.success(
                  `${selected.length} panitia ditugaskan ke acara ini`,
                );
              } catch {
                setError(
                  "Penugasan gagal disimpan. Periksa koneksi Anda lalu coba lagi.",
                );
              }
            }}
          >
            Tugaskan {selected.length} panitia
          </Button>
        </div>
      </ResponsiveDialog>
      <ResponsiveDialog
        open={!!removing}
        onOpenChange={(value) => {
          if (!value && !busy) setRemoving(null);
        }}
        title={`Cabut penugasan ${removing?.name ?? ""}?`}
        description="Panitia tidak dapat lagi memindai tiket acara ini. Akunnya tetap aktif untuk acara lain."
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
            onClick={() => setRemoving(null)}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={disabled}
            loading={revoke.isPending}
            onClick={async () => {
              if (!removing) return;
              try {
                await revoke.mutateAsync(removing.userId);
                setRemoving(null);
                toast.success("Penugasan panitia dicabut");
              } catch {
                setError("Penugasan gagal dicabut. Silakan coba lagi.");
              }
            }}
          >
            Cabut penugasan
          </Button>
        </div>
      </ResponsiveDialog>
    </section>
  );
}

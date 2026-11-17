"use client";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/elements/PageHeader";
import { QueryState } from "@/components/elements/QueryState";
import { useOrgEvent, useCancelEvent, useDuplicateEvent } from "../hooks";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useOnline } from "@/hooks/use-online";
import { Alert } from "@/components/elements/Alert";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { organizerEventsApi } from "../api";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/format";

export function ManageEventTabs({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/\/(edit|scan)(\/|$)/.test(pathname)) return children;
  return <ManageWorkspace>{children}</ManageWorkspace>;
}
function ManageWorkspace({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const event = useOrgEvent(id);
  const cancel = useCancelEvent(id);
  const duplicate = useDuplicateEvent(id);
  const me = useWorkspaceMe();
  const online = useOnline();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const disabled = !online || !!me.data?.organizer.frozen;
  if (event.isPending || event.isError)
    return (
      <QueryState
        loading={event.isPending}
        error={event.error}
        retry={event.refetch}
      />
    );
  const base = `/events/${id}`;
  const active = pathname.replace(/^\/organizer/, "");
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title={event.data.title}
        description={`${event.data.startsAt ? formatDateLong(event.data.startsAt) : "Belum dijadwalkan"}, ${event.data.venueName || "Lokasi belum diisi"}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/scan`}>Scan tiket</Link>
            </Button>
            <Button variant="outline" asChild={!disabled} disabled={disabled}>
              {disabled ? (
                <span>Ubah acara</span>
              ) : (
                <Link href={`${base}/edit`}>Ubah acara</Link>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Tindakan acara"
                >
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={event.data.publicationStatus !== "published"}
                  onSelect={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `https://gatherly.xyz/events/${event.data.slug}`,
                      );
                      toast.success("Tautan acara disalin");
                    } catch {
                      toast.error("Tautan gagal disalin");
                    }
                  }}
                >
                  Salin tautan publik
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={disabled || duplicate.isPending}
                  onSelect={() =>
                    duplicate.mutate(undefined, {
                      onSuccess: (result) =>
                        router.push(
                          `/events/${(result as Awaited<ReturnType<typeof organizerEventsApi.duplicate>>).data.id}/edit`,
                        ),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  Duplikat acara
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    disabled ||
                    ["cancelled", "ended", "draft"].includes(event.data.status)
                  }
                  onSelect={() => {
                    cancel.reset();
                    setReason("");
                    setCancelling(true);
                  }}
                >
                  Batalkan acara
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <nav
          aria-label="Kelola acara"
          className="flex flex-wrap gap-x-5 gap-y-1"
        >
          {[
            ["", "Ringkasan"],
            ["/orders", "Pesanan"],
            ["/attendees", "Peserta"],
            ["/tickets", "Tiket"],
            ["/committee", "Panitia"],
          ].map(([path, label]) => (
            <Link
              key={path}
              href={`${base}${path}`}
              aria-current={active === `${base}${path}` ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center border-b-2 border-transparent text-sm font-semibold text-text-secondary",
                active === `${base}${path}` &&
                  "border-foreground font-extrabold text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {event.data.status === "cancelled" && (
        <Alert tone="warning" title="Acara dibatalkan">
          Penjualan ditutup. Status pengembalian dana dapat dipantau pada setiap
          pesanan.
        </Alert>
      )}
      {children}
      <DangerConfirmDialog
        open={cancelling}
        onOpenChange={(open) => !cancel.isPending && setCancelling(open)}
        title="Batalkan acara?"
        description="Penjualan akan dihentikan. Pembatalan dan pengembalian dana diproses sesuai kebijakan acara."
        confirmText={event.data.title}
        confirmLabel="Batalkan acara"
        canConfirm={!disabled && !!reason.trim()}
        loading={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() =>
          cancel.mutate(
            { confirmTitle: event.data.title, reason: reason.trim() },
            {
              onSuccess: () => {
                setCancelling(false);
                toast.success("Pembatalan acara diterima");
              },
            },
          )
        }
      >
        <Field label="Alasan pembatalan" htmlFor="cancel-reason">
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </DangerConfirmDialog>
    </div>
  );
}

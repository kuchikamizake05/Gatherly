"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import imageCompression from "browser-image-compression";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  CircleHelp,
  LogOut,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { authApi } from "@/modules/auth/api";
import { useSignOut } from "@/modules/auth/use-sign-out";
import {
  useAccount,
  useDeleteAccount,
  useSignOutOtherDevices,
  useUnlinkGoogle,
  useUpdateNotifications,
  useUpdateProfile,
} from "@/modules/account/hooks";
import type { Account } from "@/modules/account/api";
import { useTickets } from "@/modules/tickets/hooks";
import { eventEnded } from "@/modules/tickets/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/elements/Alert";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { StateView } from "@/components/elements/StateView";
import { initials } from "@/components/elements/AccountMenu";

import { PasswordDialog } from "./PasswordDialog";
import { MAIL } from "@/lib/site";

/**
 * Akun saya. Pita 12.
 * Desktop: navigasi bagian di kiri mengikuti posisi gulir. Mobile: kartu bertumpuk dan bagian Lainnya.
 */

const SECTIONS = [
  { id: "profil", label: "Profil", icon: User },
  { id: "keamanan", label: "Keamanan", icon: ShieldCheck },
  { id: "notifikasi", label: "Notifikasi", icon: Bell },
  { id: "hapus-akun", label: "Hapus akun", icon: Trash2 },
] as const;

const PHONE = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi")
    .min(2, "Nama lengkap wajib diisi")
    .max(80),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || PHONE.test(v.replace(/[\s-]/g, "")),
      "Nomor ponsel belum lengkap, contoh 0812 3456 7890",
    ),
});
type ProfileValues = z.infer<typeof profileSchema>;

function Card({
  id,
  title,
  description,
  tone,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="flex scroll-mt-28 flex-col gap-1 rounded-xl border border-border-strong px-5 pt-5 pb-2 md:px-7 md:pt-6 md:pb-3"
    >
      <div className="flex flex-col gap-1 pb-3">
        <h2
          id={id ? `${id}-title` : undefined}
          className={cn(
            "text-xl font-extrabold",
            tone === "danger" && "text-danger-ink",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm font-medium text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  action,
  strong = true,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-border py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-text-secondary">
          {label}
        </span>
        <span className={cn("text-base", strong && "font-bold")}>{value}</span>
      </div>
      {action}
    </div>
  );
}

function Avatar({
  name,
  url,
  size = 64,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint text-[22px] font-extrabold text-primary-ink"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function ProfileCard({
  account,
  online,
}: {
  account: Account;
  online: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState<{ file: File; url: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const update = useUpdateProfile();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    values: { name: account.name, phone: account.phone ?? "" },
  });
  const { register, handleSubmit, formState, reset } = form;

  const cancel = () => {
    reset();
    setAvatar(null);
    setEditing(false);
  };

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Gunakan gambar JPG atau PNG.");
    try {
      const small = await imageCompression(file, {
        maxSizeMB: 0.95,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
      const out = new File([small], file.name, {
        type: small.type || file.type,
      });
      setAvatar({ file: out, url: URL.createObjectURL(out) });
    } catch {
      toast.error("Foto gagal diproses. Coba foto lain.");
    }
  };

  const joined = `Bergabung sejak ${format(new Date(account.joinedAt), "MMMM yyyy", { locale: localeId })}`;

  return (
    <Card
      id="profil"
      title="Profil"
      description="Nama dan nomor ponsel dipakai pada e-tiket dan pesanan Anda."
    >
      <div className="flex items-center gap-4 pt-1 pb-4">
        <Avatar name={account.name} url={avatar?.url ?? account.avatarUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-lg font-extrabold">
            {account.name}
          </span>
          <span className="text-sm font-medium text-text-secondary">
            {joined}
          </span>
        </div>
        {editing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Ganti foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Pilih foto profil"
              onChange={(e) => pickAvatar(e.target.files?.[0])}
            />
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={!online}
          >
            <span className="md:hidden">Ubah</span>
            <span className="hidden md:inline">Ubah profil</span>
          </Button>
        )}
      </div>

      {editing ? (
        <form
          noValidate
          className="flex flex-col gap-4 border-t border-border pt-4 pb-4"
          onSubmit={handleSubmit((v) =>
            update.mutate(
              {
                name: v.name.trim(),
                phone: v.phone.replace(/[\s-]/g, "") || null,
                avatar: avatar?.file,
              },
              {
                onSuccess: () => {
                  toast.success("Profil berhasil diperbarui");
                  setAvatar(null);
                  setEditing(false);
                },
                onError: () =>
                  toast.error("Perubahan belum tersimpan. Silakan coba lagi."),
              },
            ),
          )}
        >
          <Field
            label="Nama lengkap"
            htmlFor="acc-name"
            error={formState.errors.name?.message}
          >
            <Input
              id="acc-name"
              autoComplete="name"
              aria-invalid={!!formState.errors.name}
              {...register("name")}
            />
          </Field>
          <Field
            label="Email"
            htmlFor="acc-email"
            helper="Email tidak dapat diubah karena terhubung dengan pesanan Anda."
          >
            <Input id="acc-email" value={account.email} disabled readOnly />
          </Field>
          <Field
            label="Nomor ponsel"
            htmlFor="acc-phone"
            helper="Dipakai untuk menghubungi Anda bila acara berubah."
            error={formState.errors.phone?.message}
          >
            <Input
              id="acc-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              aria-invalid={!!formState.errors.phone}
              {...register("phone")}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2.5 pt-1 md:flex-row md:justify-end">
            <Button type="button" variant="ghost" onClick={cancel}>
              Batal
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!online}>
              {update.isPending ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Row label="Nama lengkap" value={account.name} />
          <Row
            label="Email"
            value={
              <span className="flex flex-wrap items-center gap-3">
                <span className="break-all">{account.email}</span>
                <Badge tone="success">Terverifikasi</Badge>
              </span>
            }
          />
          <Row
            label="Nomor ponsel"
            value={
              account.phone ?? (
                <span className="font-medium text-text-tertiary">
                  Belum diisi
                </span>
              )
            }
          />
        </>
      )}
    </Card>
  );
}

export function AccountView() {
  const router = useRouter();
  const online = useOnline();
  const account = useAccount();
  const tickets = useTickets();
  const unlink = useUnlinkGoogle();
  const signOutOthers = useSignOutOtherDevices();
  const notifications = useUpdateNotifications();
  const del = useDeleteAccount();
  const { signOut } = useSignOut();

  const [active, setActive] = useState<string>("profil");
  const [dialog, setDialog] = useState<
    | null
    | "password"
    | "unlink"
    | "need-password"
    | "devices"
    | "delete"
    | "blocked"
  >(null);
  const [blockedCount, setBlockedCount] = useState(0);

  // Sesi habis saat halaman terbuka (J4): kembali ke Masuk lalu ke sini lagi.
  const unauthorized =
    account.error instanceof ApiError && account.error.status === 401;
  useEffect(() => {
    if (unauthorized)
      router.replace(
        `/login?returnTo=${encodeURIComponent("/account")}&reason=session`,
      );
  }, [unauthorized, router]);

  // Navigasi bagian mengikuti posisi gulir (desktop).
  useEffect(() => {
    if (!account.data) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean,
    ) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [account.data]);

  if (account.isPending || unauthorized) return <AccountSkeleton />;
  if (account.isError && !account.data)
    return (
      <StateView
        tone="error"
        illustration="failed-load"
        title="Data akun gagal dimuat"
        description="Periksa koneksi Anda, lalu coba lagi."
        action={
          <Button
            onClick={() => account.refetch()}
            loading={account.isRefetching}
          >
            Coba lagi
          </Button>
        }
      />
    );

  const a = account.data!;
  const upcomingTickets = (tickets.data?.data ?? []).filter(
    (t) => !eventEnded(t.event) && t.event.status !== "cancelled",
  ).length;
  const passwordValue = !a.hasPassword
    ? "Belum dibuat"
    : a.passwordChangedAt
      ? `Terakhir diubah ${isToday(new Date(a.passwordChangedAt)) ? "hari ini" : formatRelative(a.passwordChangedAt)}`
      : "Sudah dibuat";

  const toggle = (key: keyof Account["notifications"], value: boolean) =>
    notifications.mutate(
      { ...a.notifications, [key]: value },
      {
        onSuccess: () => toast.success("Pengaturan notifikasi disimpan"),
        onError: () =>
          toast.error("Pengaturan belum tersimpan. Silakan coba lagi."),
      },
    );

  const openDelete = () => {
    if (upcomingTickets > 0) {
      setBlockedCount(upcomingTickets);
      setDialog("blocked");
    } else setDialog("delete");
  };

  const actionLabel = (short: string, long: string) => (
    <>
      <span className="md:hidden">{short}</span>
      <span className="hidden md:inline">{long}</span>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-32 md:gap-8 md:px-6 md:pt-10 md:pb-24 xl:px-0">
      <div className="flex flex-col gap-2 px-1 md:px-0">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
          Akun saya
        </h1>
        <p className="hidden text-base font-medium text-text-secondary md:block">
          Kelola data diri, keamanan, dan notifikasi akun Anda.
        </p>
      </div>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Data yang tampil adalah data terakhir. Perubahan dapat disimpan
          setelah koneksi kembali.
        </Alert>
      )}

      <div className="grid gap-12 xl:grid-cols-[240px_minmax(0,832px)] xl:justify-between">
        <nav aria-label="Bagian akun" className="hidden xl:block">
          <ul className="sticky top-28 flex flex-col gap-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActive(id);
                  }}
                  className={cn(
                    "press flex h-10 items-center gap-2.5 rounded-md px-3.5 text-[15px] transition-colors",
                    active === id
                      ? "bg-surface-2 font-extrabold"
                      : "font-semibold text-text-secondary [@media(hover:hover)]:hover:bg-surface",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <ProfileCard account={a} online={online} />

          <Card id="keamanan" title="Keamanan">
            <Row
              label="Password"
              value={passwordValue}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialog("password")}
                  disabled={!online}
                >
                  {a.hasPassword
                    ? actionLabel("Ubah", "Ubah password")
                    : "Buat password"}
                </Button>
              }
            />
            <Row
              label="Akun Google"
              value={
                a.googleEmail ? (
                  <span className="break-all">
                    Terhubung sebagai {a.googleEmail}
                  </span>
                ) : (
                  "Belum terhubung"
                )
              }
              action={
                a.googleEmail ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDialog(a.hasPassword ? "unlink" : "need-password")
                    }
                    disabled={!online}
                  >
                    Putuskan
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <a href={authApi.googleUrl("/account")}>Hubungkan</a>
                  </Button>
                )
              }
            />
            <Row
              label="Perangkat yang masuk"
              value={`${a.activeDevices} perangkat aktif`}
              action={
                a.activeDevices > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog("devices")}
                    disabled={!online}
                  >
                    {actionLabel("Keluar semua", "Keluar dari semua perangkat")}
                  </Button>
                )
              }
            />
          </Card>

          <Card
            id="notifikasi"
            title="Notifikasi email"
            description="Atur email yang ingin Anda terima."
          >
            {(
              [
                {
                  key: "reminders",
                  title: "Pengingat acara",
                  desc: "Dikirim satu hari sebelum acara dimulai.",
                },
                {
                  key: "schedule",
                  title: "Perubahan jadwal atau lokasi",
                  desc: "Selalu dikirim karena berkaitan dengan tiket Anda.",
                },
                {
                  key: "recommendations",
                  title: "Rekomendasi acara",
                  desc: "Acara baru di sekitar Anda, paling banyak satu kali seminggu.",
                },
              ] as const
            ).map((n) => {
              const locked = n.key === "schedule";
              const checked = locked ? true : a.notifications[n.key];
              return (
                <label
                  key={n.key}
                  htmlFor={`notif-${n.key}`}
                  className={cn(
                    "flex items-center gap-4 border-t border-border py-4",
                    !locked && "cursor-pointer",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-base font-bold">{n.title}</span>
                    <span className="text-sm font-medium text-text-secondary">
                      {n.desc}
                    </span>
                  </span>
                  <Switch
                    id={`notif-${n.key}`}
                    checked={checked}
                    disabled={locked || !online}
                    onCheckedChange={(v) => !locked && toggle(n.key, v)}
                  />
                </label>
              );
            })}
          </Card>

          {/* Mobile: tautan lain yang di desktop ada di menu akun */}
          <div className="md:hidden">
            <Card title="Lainnya">
              <div className="flex flex-col">
                {[
                  {
                    label: "Daftar jadi organizer",
                    icon: CalendarPlus,
                    href: "/become-organizer",
                  },
                  {
                    label: "Pusat bantuan",
                    icon: CircleHelp,
                    href: `mailto:${MAIL.halo}`,
                  },
                ].map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="press flex items-center gap-3 border-t border-border py-4 text-base font-bold"
                  >
                    <l.icon className="size-5" aria-hidden />
                    <span className="flex-1">{l.label}</span>
                    <ChevronRight
                      className="size-5 text-text-tertiary"
                      aria-hidden
                    />
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={signOut}
                  className="press flex items-center gap-3 border-t border-border py-4 text-left text-base font-bold text-danger-ink"
                >
                  <LogOut className="size-5" aria-hidden />
                  Keluar
                </button>
              </div>
            </Card>
          </div>

          <Card
            id="hapus-akun"
            title="Hapus akun"
            tone="danger"
            description="Semua data akun akan dihapus permanen. Akun dapat dihapus setelah semua acara yang Anda ikuti selesai."
          >
            <div className="pt-2 pb-4">
              <Button variant="danger" onClick={openDelete} disabled={!online}>
                Hapus akun
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <PasswordDialog
        open={dialog === "password"}
        onOpenChange={(o) => setDialog(o ? "password" : null)}
        hasPassword={a.hasPassword}
      />

      <DangerConfirmDialog
        open={dialog === "unlink"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Putuskan akun Google?"
        description="Anda tidak dapat lagi masuk dengan Google. Anda tetap dapat masuk dengan email dan password."
        cancelLabel="Batal"
        confirmLabel="Putuskan"
        loading={unlink.isPending}
        onConfirm={() =>
          unlink.mutate(undefined, {
            onSuccess: () => {
              setDialog(null);
              toast.success("Akun Google telah diputuskan");
            },
            onError: () =>
              toast.error("Akun Google gagal diputuskan. Coba lagi."),
          })
        }
      />

      <DangerConfirmDialog
        open={dialog === "need-password"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Buat password terlebih dahulu"
        description="Akun Anda hanya dapat masuk dengan Google. Buat password agar Anda tetap dapat masuk setelah Google diputuskan."
        cancelLabel="Batal"
        confirmLabel="Buat password"
        confirmVariant="primary"
        onConfirm={() => setDialog("password")}
      />

      <DangerConfirmDialog
        open={dialog === "devices"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Keluar dari perangkat lain?"
        description="Anda tetap masuk di perangkat ini. Perangkat lain perlu masuk kembali."
        cancelLabel="Batal"
        confirmLabel="Keluar"
        loading={signOutOthers.isPending}
        onConfirm={() =>
          signOutOthers.mutate(undefined, {
            onSuccess: (r) => {
              setDialog(null);
              toast.success(
                `Anda telah keluar dari ${r.signedOut || a.activeDevices - 1} perangkat lain`,
              );
            },
            onError: () =>
              toast.error("Gagal keluar dari perangkat lain. Coba lagi."),
          })
        }
      />

      <DangerConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Hapus akun secara permanen?"
        description="Profil, riwayat pesanan, dan acara yang disimpan akan dihapus. Tindakan ini tidak dapat dibatalkan."
        confirmText="hapus akun"
        cancelLabel="Batal"
        confirmLabel="Hapus akun"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate("hapus akun", {
            onSuccess: () => {
              setDialog(null);
              toast("Akun Anda telah dihapus");
              router.replace("/");
            },
            onError: (e) => {
              if (e instanceof ApiError && e.status === 409) {
                const count =
                  Number(
                    (e.details as { activeTickets?: number } | undefined)
                      ?.activeTickets,
                  ) || upcomingTickets;
                setBlockedCount(count);
                setDialog("blocked");
              } else toast.error("Akun gagal dihapus. Coba lagi.");
            },
          })
        }
      />

      <DangerConfirmDialog
        open={dialog === "blocked"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Akun belum dapat dihapus"
        description={`Anda masih memiliki ${blockedCount} tiket untuk acara yang akan datang. Akun dapat dihapus setelah acara tersebut selesai.`}
        cancelLabel="Tutup"
        confirmLabel="Lihat Tiketku"
        confirmVariant="primary"
        onConfirm={() => router.push("/tickets")}
      />
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-14 md:px-6 md:pt-10 xl:px-0"
      aria-busy
    >
      <span className="skeleton h-10 w-56 rounded" />
      <div className="grid gap-12 xl:grid-cols-[240px_minmax(0,832px)] xl:justify-between">
        <span className="skeleton hidden h-[172px] rounded-lg xl:block" />
        <div className="flex flex-col gap-6">
          <span className="skeleton h-[428px] rounded-xl" />
          <span className="skeleton h-[315px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

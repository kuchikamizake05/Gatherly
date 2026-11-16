"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useChangePassword } from "@/modules/account/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/elements/IconInput";
import { PASSWORD_MIN } from "@/components/elements/PasswordStrength";

/**
 * Ubah password (pita 12 C2, I3, I4). Bila akun belum punya password (masuk dengan Google saja),
 * dialog ini membuat password pertama tanpa isian password saat ini (I6).
 */

const schema = (needCurrent: boolean) =>
  z
    .object({
      current: needCurrent ? z.string().min(1, "Isi password saat ini") : z.string(),
      next: z.string().min(PASSWORD_MIN, `Password minimal ${PASSWORD_MIN} karakter`).max(128),
      confirm: z.string().min(1, "Ketik ulang password baru"),
    })
    .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Password belum sama dengan isian sebelumnya" })
    .refine((v) => !needCurrent || v.next !== v.current, { path: ["next"], message: "Gunakan password yang berbeda dari password saat ini" });

type Values = { current: string; next: string; confirm: string };

function PasswordForm({ hasPassword, onDone, desktop }: { hasPassword: boolean; onDone: () => void; desktop: boolean }) {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema(hasPassword)), mode: "onBlur", defaultValues: { current: "", next: "", confirm: "" } });
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit((v) =>
        change.mutate(
          { currentPassword: hasPassword ? v.current : undefined, newPassword: v.next },
          {
            onSuccess: () => {
              toast.success(hasPassword ? "Password berhasil diubah" : "Password berhasil dibuat");
              onDone();
            },
            onError: (e) => {
              const code = e instanceof ApiError ? e.code : "";
              if (code === "INVALID_PASSWORD" || (e instanceof ApiError && e.status === 401))
                setError("current", { message: "Password saat ini tidak sesuai" }, { shouldFocus: true });
              else if (code === "PASSWORD_REUSED") setError("next", { message: "Gunakan password yang berbeda dari password saat ini" }, { shouldFocus: true });
              else if (e instanceof ApiError && e.status === 429) setError("current", { message: "Terlalu banyak percobaan. Coba lagi dalam 10 menit." });
              else toast.error("Perubahan belum tersimpan. Silakan coba lagi.");
            },
          },
        ),
      )}
    >
      <div className="flex flex-col gap-2">
        <Title className="text-[22px]">{hasPassword ? "Ubah password" : "Buat password"}</Title>
        <Description className="text-[15px] font-medium">
          {hasPassword
            ? "Setelah password diubah, Anda tetap masuk di perangkat ini dan dikeluarkan dari perangkat lain."
            : "Dengan password, Anda tetap dapat masuk memakai email walaupun akun Google diputuskan."}
        </Description>
      </div>

      {hasPassword && (
        <Field
          label="Password saat ini"
          htmlFor="pw-current"
          error={errors.current?.message}
          labelAside={
            <Link href="/forgot-password" className="text-[13px] font-bold underline-offset-4 [@media(hover:hover)]:hover:underline">
              Lupa password saat ini?
            </Link>
          }
        >
          <PasswordInput id="pw-current" autoComplete="current-password" aria-invalid={!!errors.current} {...register("current")} />
        </Field>
      )}
      <Field
        label="Password baru"
        htmlFor="pw-next"
        helper={`Minimal ${PASSWORD_MIN} karakter${hasPassword ? " dan berbeda dari password saat ini" : ""}.`}
        error={errors.next?.message}
      >
        <PasswordInput id="pw-next" autoComplete="new-password" aria-invalid={!!errors.next} {...register("next")} />
      </Field>
      <Field label="Ulangi password baru" htmlFor="pw-confirm" error={errors.confirm?.message}>
        <PasswordInput id="pw-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>

      <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" loading={change.isPending}>
          {change.isPending ? "Menyimpan…" : "Simpan password"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordDialog({ open, onOpenChange, hasPassword }: { open: boolean; onOpenChange: (o: boolean) => void; hasPassword: boolean }) {
  const desktop = useIsDesktop();
  const close = () => onOpenChange(false);

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="p-7 sm:max-w-[520px]">
          {open && <PasswordForm hasPassword={hasPassword} onDone={close} desktop />}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          {open && <PasswordForm hasPassword={hasPassword} onDone={close} desktop={false} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

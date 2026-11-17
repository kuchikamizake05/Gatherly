"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/elements/IconInput";
import { PasswordRules } from "@/components/elements/PasswordStrength";
import { Alert } from "@/components/elements/Alert";
import { useOnline } from "@/hooks/use-online";

export function PasswordForm({
  current = false,
  pending,
  error,
  onSubmit,
}: {
  current?: boolean;
  pending: boolean;
  error?: Error | null;
  onSubmit: (values: { currentPassword: string; password: string }) => void;
}) {
  const schema = z
    .object({
      currentPassword: current
        ? z.string().min(1, "Password saat ini wajib diisi")
        : z.string(),
      password: z.string().min(12, "Gunakan minimal 12 karakter"),
      confirmation: z.string(),
    })
    .refine((v) => v.password === v.confirmation, {
      path: ["confirmation"],
      message: "Konfirmasi password tidak cocok",
    })
    .refine((v) => !current || v.password !== v.currentPassword, {
      path: ["password"],
      message: "Password baru harus berbeda",
    });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", password: "", confirmation: "" },
  });
  const online = useOnline();
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && <Alert title="Password belum tersimpan">{error.message}</Alert>}
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Hubungkan internet untuk mengganti password.
        </Alert>
      )}
      {current && (
        <Field
          label="Password saat ini"
          htmlFor="current-password"
          error={errors.currentPassword?.message}
          reserveMessageSpace
        >
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            {...register("currentPassword")}
          />
        </Field>
      )}
      <Field
        label="Password baru"
        htmlFor="new-password"
        error={errors.password?.message}
        helper="Minimal 12 karakter, berbeda dari password sebelumnya."
        reserveMessageSpace
      >
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <PasswordRules
        value={watch("password")}
        sameAsOld={
          !!watch("password") && watch("password") === watch("currentPassword")
        }
      />
      <Field
        label="Konfirmasi password baru"
        htmlFor="confirm-password"
        error={errors.confirmation?.message}
        reserveMessageSpace
      >
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmation}
          {...register("confirmation")}
        />
      </Field>
      <Button
        type="submit"
        className="w-full md:w-auto"
        disabled={pending || !online}
      >
        {pending ? "Menyimpan…" : "Simpan password"}
      </Button>
    </form>
  );
}

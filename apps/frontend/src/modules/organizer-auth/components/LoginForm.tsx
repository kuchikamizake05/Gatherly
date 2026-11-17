"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/elements/IconInput";
import { Alert } from "@/components/elements/Alert";
import { AuthActions, AuthHeading } from "@/modules/auth/components/AuthUi";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceLogin } from "../hooks";

const schema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});
export function workspaceReturnTo(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(value) &&
    !/^\/(login|change-password|reset-password|forgot-password)(\/|\?|$)/.test(
      value,
    )
    ? value
    : "/";
}
export function LoginForm() {
  const login = useWorkspaceLogin();
  const router = useRouter();
  const search = useSearchParams();
  const online = useOnline();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });
  return (
    <form
      className="flex flex-1 flex-col gap-5"
      noValidate
      onSubmit={handleSubmit((values) =>
        login.mutate(values, {
          onSuccess: ({ data }) =>
            router.replace(
              data.mustChangePassword
                ? "/change-password"
                : data.role === "committee"
                  ? "/"
                  : workspaceReturnTo(search.get("returnTo")),
            ),
        }),
      )}
    >
      <AuthHeading title="Masuk ke ruang organizer">
        Kelola acara atau lakukan check-in sebagai panitia dengan akun Anda.
      </AuthHeading>
      {search.get("reason") === "session" && (
        <Alert tone="warning" title="Sesi Anda telah berakhir">
          Silakan masuk kembali untuk melanjutkan.
        </Alert>
      )}
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Masuk memerlukan koneksi internet.
        </Alert>
      )}
      {login.error && (
        <Alert title="Tidak dapat masuk">{login.error.message}</Alert>
      )}
      <Field
        label="Username"
        htmlFor="username"
        error={errors.username?.message}
        reserveMessageSpace
      >
        <Input
          id="username"
          autoComplete="username"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        reserveMessageSpace
        labelAside={
          <Link
            href="/forgot-password"
            className="text-sm font-semibold underline"
          >
            Lupa password?
          </Link>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <AuthActions>
        <Button
          type="submit"
          className="w-full"
          disabled={!online || login.isPending}
        >
          {login.isPending ? "Memasuki ruang kerja…" : "Masuk"}
        </Button>
      </AuthActions>
      <p className="text-sm text-text-secondary">
        Akun panitia dibuat oleh organizer. Hubungi organizer jika Anda belum
        memiliki akses.
      </p>
    </form>
  );
}

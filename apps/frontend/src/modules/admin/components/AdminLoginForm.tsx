"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/elements/IconInput";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";
import { useOnline } from "@/hooks/use-online";
import { ApiError } from "@/lib/api/client";
import { useAdminLogin } from "@/modules/admin/hooks";
import { ADMIN_EMAIL_DOMAIN, MAIL } from "@/lib/site";
const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Masukkan alamat email yang valid.")
    .refine(
      (value) => value.endsWith(`@${ADMIN_EMAIL_DOMAIN}`) && !value.slice(0, -ADMIN_EMAIL_DOMAIN.length - 1).includes("@"),
      "Gunakan email kerja Gatherly.",
    ),
  password: z.string().min(1, "Masukkan password Anda."),
});
type Values = z.infer<typeof schema>;
export function AdminLoginForm() {
  const router = useRouter();
  const login = useAdminLogin();
  const online = useOnline();
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("gatherly_admin_session_expired")) {
      setError("Sesi Anda telah berakhir. Masuk kembali untuk melanjutkan.");
      sessionStorage.removeItem("gatherly_admin_session_expired");
    }
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });
  const submit = handleSubmit(
    async (values) => {
      if (!online || login.isPending) return;
      setError("");
      try {
        const result = await login.mutateAsync(values);
        sessionStorage.setItem(
          "gatherly_admin_challenge",
          result.data.challengeId,
        );
        router.push("/verify");
      } catch (e) {
        setError(
          e instanceof ApiError
            ? ((
                {
                  ACCOUNT_LOCKED:
                    "Akun dikunci sementara. Hubungi admin utama.",
                  ACCOUNT_DISABLED: "Akun dinonaktifkan. Hubungi admin utama.",
                  RATE_LIMITED:
                    "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
                  NETWORK_ERROR:
                    "Koneksi terputus. Periksa internet Anda lalu coba lagi.",
                } as Record<string, string>
              )[e.code] ??
                "Tidak dapat masuk. Periksa email dan password Anda lalu coba lagi.")
            : "Koneksi terputus. Periksa internet Anda lalu coba lagi.",
        );
      }
    },
    () =>
      document
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
  );
  if (help)
    return (
      <StateView
        illustration="waiting"
        title="Hubungi admin utama"
        description={`Demi keamanan, password akun admin hanya dapat diatur ulang oleh admin utama. Kirim permintaan ke ${MAIL.it} dari email kerja Anda.`}
        action={
          <Button onClick={() => setHelp(false)}>Kembali ke masuk</Button>
        }
      />
    );
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-3xl font-extrabold">Masuk ke admin Gatherly</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Khusus tim Gatherly. Setiap aktivitas di halaman admin tercatat.
        </p>
      </div>
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Periksa koneksi Anda untuk melanjutkan.
        </Alert>
      )}
      {error && <Alert title={error} />}
      <Field
        label="Email kerja"
        htmlFor="admin-email"
        error={errors.email?.message}
      >
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "admin-email-message" : undefined}
          {...register("email")}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="admin-password"
        error={errors.password?.message}
        labelAside={
          <button
            type="button"
            onClick={() => setHelp(!help)}
            className="min-h-11 text-xs underline"
          >
            Lupa password?
          </button>
        }
      >
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      {help && (
        <Alert tone="info" title="Hubungi admin utama">
          Password admin diatur ulang melalui admin utama Gatherly.
        </Alert>
      )}
      <Button type="submit" loading={login.isPending} disabled={!online} block>
        {login.isPending ? "Memeriksa akun…" : "Masuk"}
      </Button>
    </form>
  );
}

import type { ReactNode } from "react";

import { AuthShell } from "@/modules/auth/components/AuthShell";

/** Masuk, daftar, verifikasi, dan lupa password. Pita 10 dan 11. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

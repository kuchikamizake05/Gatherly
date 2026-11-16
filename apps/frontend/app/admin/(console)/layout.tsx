import type { ReactNode } from "react";

import { RequireAdmin } from "@/components/layout/guards";
import { AdminShell } from "./shell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AdminShell>{children}</AdminShell>
    </RequireAdmin>
  );
}

import type { ReactNode } from "react";

import { RequireAdmin } from "@/components/layout/Guards";
import { AdminShell } from "@/modules/admin/components/AdminShell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AdminShell>{children}</AdminShell>
    </RequireAdmin>
  );
}

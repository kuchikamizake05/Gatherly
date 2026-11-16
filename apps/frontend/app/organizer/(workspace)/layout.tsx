import type { ReactNode } from "react";

import { RequireWorkspace } from "@/components/layout/guards";
import { OrganizerShell } from "./shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireWorkspace>
      <OrganizerShell>{children}</OrganizerShell>
    </RequireWorkspace>
  );
}

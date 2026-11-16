import type { ReactNode } from "react";

import { RequireWorkspace } from "@/components/layout/Guards";
import { OrganizerShell } from "@/modules/organizer-auth/components/OrganizerShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireWorkspace>
      <OrganizerShell>{children}</OrganizerShell>
    </RequireWorkspace>
  );
}

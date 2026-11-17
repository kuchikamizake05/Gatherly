import type { ReactNode } from "react";
import { OrganizerAuthShell } from "@/modules/organizer-auth/components/OrganizerAuthShell";
export default function Layout({ children }: { children: ReactNode }) {
  return <OrganizerAuthShell>{children}</OrganizerAuthShell>;
}

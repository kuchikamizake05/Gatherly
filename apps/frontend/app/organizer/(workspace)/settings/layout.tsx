import type { ReactNode } from "react";
import { SettingsNav } from "@/modules/organizer-settings/components/SettingsNav";
export default function Layout({ children }: { children: ReactNode }) { return <SettingsNav>{children}</SettingsNav>; }

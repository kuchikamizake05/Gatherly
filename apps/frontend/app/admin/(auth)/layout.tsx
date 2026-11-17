import type { ReactNode } from "react";
import { AdminAuthShell } from "@/modules/admin/components/AdminAuthShell";
export default function AdminAuthLayout({children}:{children:ReactNode}) {return <AdminAuthShell>{children}</AdminAuthShell>;}

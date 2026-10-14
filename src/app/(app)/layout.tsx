import type { ReactNode } from "react";
import { requireAppUser } from "@/actions/auth";
import { AppShell } from "@/components/shell/AppShell";
import type { AppRole } from "@/lib/nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAppUser();

  return (
    <AppShell role={user.role as AppRole} displayName={user.displayName}>
      {children}
    </AppShell>
  );
}

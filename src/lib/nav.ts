/** Role-aware sidebar nav (U1-02). No Agent group in Release 1. */

export type AppRole = "admin" | "builder" | "viewer";

export type NavItem = {
  href: string;
  label: string;
  /** When set, only these roles see the item. */
  roles?: readonly AppRole[];
};

export const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/flows", label: "Flows" },
  { href: "/company", label: "Company" },
  { href: "/profile", label: "Profile" },
] as const;

export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/users", label: "Users", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
] as const;

export function navForRole(role: AppRole): NavItem[] {
  const adminExtra = role === "admin" ? [...ADMIN_NAV] : [];
  return [...BASE_NAV, ...adminExtra];
}

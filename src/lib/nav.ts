/** Role-aware sidebar nav (U1-02). No Agent group in Release 1.
 * Profile, Company, Settings, and Sign out live in the top-right user menu.
 */

export type AppRole = "admin" | "builder" | "viewer";

export type NavIconId = "dashboard" | "invoices" | "flows" | "users";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
  /** When set, only these roles see the item. */
  roles?: readonly AppRole[];
};

export const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  { href: "/flows", label: "Flows", icon: "flows" },
] as const;

export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/users", label: "Users", icon: "users", roles: ["admin"] },
] as const;

export function navForRole(role: AppRole): NavItem[] {
  const adminExtra = role === "admin" ? [...ADMIN_NAV] : [];
  return [...BASE_NAV, ...adminExtra];
}

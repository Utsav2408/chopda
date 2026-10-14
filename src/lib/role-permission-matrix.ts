/**
 * Human-readable role permission matrix for Admin settings (U2-05).
 * Mirrors allow/deny expectations from the B9 role matrix for key product ops.
 */

export type MatrixRole = "viewer" | "builder" | "admin";

export type MatrixCell = "allow" | "deny";

export type RolePermissionRow = {
  id: string;
  operation: string;
  cells: Record<MatrixRole, MatrixCell>;
};

export const ROLE_PERMISSION_MATRIX: readonly RolePermissionRow[] = [
  {
    id: "users.create",
    operation: "Create users",
    cells: { viewer: "deny", builder: "deny", admin: "allow" },
  },
  {
    id: "users.manage",
    operation: "Deactivate / reset password / transfer Admin",
    cells: { viewer: "deny", builder: "deny", admin: "allow" },
  },
  {
    id: "flows.mutate",
    operation: "Create and edit flows",
    cells: { viewer: "deny", builder: "allow", admin: "allow" },
  },
  {
    id: "flows.read",
    operation: "View flows",
    cells: { viewer: "allow", builder: "allow", admin: "allow" },
  },
  {
    id: "invoices.create",
    operation: "Create and update invoices",
    cells: { viewer: "deny", builder: "allow", admin: "allow" },
  },
  {
    id: "invoices.read",
    operation: "View invoices",
    cells: { viewer: "allow", builder: "allow", admin: "allow" },
  },
  {
    id: "steps.complete",
    operation: "Complete invoice steps",
    cells: { viewer: "deny", builder: "allow", admin: "allow" },
  },
  {
    id: "documents.upload",
    operation: "Upload documents",
    cells: { viewer: "deny", builder: "allow", admin: "allow" },
  },
  {
    id: "documents.download",
    operation: "Download documents",
    cells: { viewer: "allow", builder: "allow", admin: "allow" },
  },
  {
    id: "company.update",
    operation: "Edit company profile and banks",
    cells: { viewer: "deny", builder: "deny", admin: "allow" },
  },
  {
    id: "company.read",
    operation: "View company profile",
    cells: { viewer: "allow", builder: "allow", admin: "allow" },
  },
  {
    id: "invoices.softDelete",
    operation: "Soft-delete / undo invoices",
    cells: { viewer: "deny", builder: "deny", admin: "allow" },
  },
] as const;

export const MATRIX_ROLES: readonly MatrixRole[] = ["viewer", "builder", "admin"] as const;

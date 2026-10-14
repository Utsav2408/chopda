import { Table, type TableColumn } from "@/components/ui";
import {
  MATRIX_ROLES,
  ROLE_PERMISSION_MATRIX,
  type MatrixRole,
  type RolePermissionRow,
} from "@/lib/role-permission-matrix";

const roleHeaders: Record<MatrixRole, string> = {
  viewer: "Viewer",
  builder: "Builder",
  admin: "Admin",
};

export function RoleMatrixPanel() {
  const columns: TableColumn<RolePermissionRow>[] = [
    {
      key: "operation",
      header: "Operation",
      cell: (row) => row.operation,
    },
    ...MATRIX_ROLES.map((role): TableColumn<RolePermissionRow> => ({
      key: role,
      header: roleHeaders[role],
      cell: (row) => {
        const value = row.cells[role];
        return (
          <span className={`settings-matrix-cell--${value}`}>
            {value === "allow" ? "Allow" : "Deny"}
          </span>
        );
      },
    })),
  ];

  return (
    <section className="settings-panel" aria-labelledby="role-matrix-heading">
      <h3 id="role-matrix-heading" className="settings-panel__title">
        Role permission matrix
      </h3>
      <p className="settings-panel__lede">
        Server checks enforce these rules on every action. Hiding a button is never enough.
      </p>
      <Table
        columns={columns}
        rows={[...ROLE_PERMISSION_MATRIX]}
        rowKey={(row) => row.id}
        caption="Role permission matrix"
      />
    </section>
  );
}

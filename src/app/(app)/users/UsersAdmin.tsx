"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useAppNavigate } from "@/lib/navigate";
import {
  usersCreateAction,
  usersDeactivateAction,
  usersReactivateAction,
  usersResetPasswordAction,
  usersTransferAdminAction,
} from "@/actions/users";
import type { ClientUser } from "@/lib/user-dto";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { ConfirmDialog, EmptyState, StatusChip, Table, type TableColumn } from "@/components/ui";
import "./users.css";

type UsersAdminProps = {
  initialUsers: ClientUser[];
  currentUserId: string;
};

type DialogKind =
  | { type: "add" }
  | { type: "deactivate"; user: ClientUser }
  | { type: "reactivate"; user: ClientUser }
  | { type: "reset"; user: ClientUser }
  | { type: "temp"; password: string; username: string }
  | { type: "transfer" }
  | null;

function roleTone(role: ClientUser["role"]): "muted" | "info" | "warning" {
  if (role === "admin") return "warning";
  if (role === "builder") return "info";
  return "muted";
}

export function UsersAdmin({ initialUsers, currentUserId }: UsersAdminProps) {
  const navigate = useAppNavigate();
  const [users, setUsers] = useState(initialUsers);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");

  const transferCandidates = useMemo(
    () => users.filter((u) => u.isActive && u.role !== "admin" && u.id !== currentUserId),
    [users, currentUserId],
  );

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setFormError(null);
    setFieldErrors(null);
    setTransferTargetId("");
  }

  function refreshUsers(next: ClientUser[]) {
    setUsers(next);
    navigate.refresh();
  }

  function onAddUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(null);
    const data = new FormData(e.currentTarget);
    const payload = {
      username: String(data.get("username") ?? "").trim(),
      displayName: String(data.get("displayName") ?? "").trim(),
      role: String(data.get("role") ?? "viewer") as "builder" | "viewer",
      email: String(data.get("email") ?? "").trim() || null,
      phone: String(data.get("phone") ?? "").trim() || null,
    };

    startTransition(async () => {
      try {
        const result = await usersCreateAction(payload);
        refreshUsers([...users, result.user].sort((a, b) => a.username.localeCompare(b.username)));
        setDialog({
          type: "temp",
          password: result.temporaryPassword,
          username: result.user.username,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not create user.";
        const mapped = fieldErrorsFromServer({ error: message });
        setFormError(mapped._form ?? message);
        setFieldErrors(mapped);
      }
    });
  }

  function onConfirmDeactivate() {
    if (dialog?.type !== "deactivate") return;
    const target = dialog.user;
    startTransition(async () => {
      try {
        const updated = await usersDeactivateAction(target.id);
        refreshUsers(users.map((u) => (u.id === updated.id ? updated : u)));
        closeDialog();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not deactivate user.");
      }
    });
  }

  function onConfirmReactivate() {
    if (dialog?.type !== "reactivate") return;
    const target = dialog.user;
    startTransition(async () => {
      try {
        const updated = await usersReactivateAction(target.id);
        refreshUsers(users.map((u) => (u.id === updated.id ? updated : u)));
        closeDialog();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not reactivate user.");
      }
    });
  }

  function onConfirmReset() {
    if (dialog?.type !== "reset") return;
    const target = dialog.user;
    startTransition(async () => {
      try {
        const result = await usersResetPasswordAction(target.id);
        setDialog({
          type: "temp",
          password: result.temporaryPassword,
          username: target.username,
        });
        navigate.refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not reset password.");
      }
    });
  }

  function onConfirmTransfer() {
    if (!transferTargetId) {
      setFormError("Select the Builder or Viewer who will become Admin.");
      return;
    }
    startTransition(async () => {
      try {
        await usersTransferAdminAction({ newAdminUserId: transferTargetId });
        closeDialog();
        // Soft navigation + refresh so the shell picks up the new role.
        navigate.push("/users");
        navigate.refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Could not transfer Admin.");
      }
    });
  }

  const columns: TableColumn<ClientUser>[] = [
    {
      key: "username",
      header: "Username",
      cell: (row) => (
        <span>
          {row.username}
          {row.id === currentUserId ? " (you)" : ""}
        </span>
      ),
    },
    {
      key: "displayName",
      header: "Display name",
      cell: (row) => row.displayName,
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => <StatusChip tone={roleTone(row.role)}>{row.role}</StatusChip>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusChip tone={row.isActive ? "success" : "danger"}>
          {row.isActive ? "Active" : "Inactive"}
        </StatusChip>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => {
        if (row.role === "admin") {
          return <span className="ui-hint">Sole Admin — use Transfer Admin</span>;
        }
        const rowLocked = pending || dialog !== null;
        return (
          <div className="users-page__row-actions">
            {row.isActive ? (
              <>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  disabled={rowLocked}
                  onClick={() => setDialog({ type: "reset", user: row })}
                >
                  Temp password
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  disabled={rowLocked}
                  onClick={() => setDialog({ type: "deactivate", user: row })}
                >
                  Deactivate
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                disabled={rowLocked}
                onClick={() => setDialog({ type: "reactivate", user: row })}
              >
                Reactivate
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="users-page">
      <div className="users-page__header">
        <div>
          <h2>Users</h2>
          <p className="users-page__lede">
            Add Builders and Viewers, issue temporary passwords, and hand over the Admin role.
          </p>
        </div>
        <div className="users-page__actions">
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            disabled={pending || dialog !== null}
            onClick={() => setDialog({ type: "transfer" })}
          >
            Transfer Admin
          </button>
          <button
            type="button"
            className="ui-btn"
            disabled={pending || dialog !== null}
            onClick={() => setDialog({ type: "add" })}
          >
            Add user
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        rows={users}
        rowKey={(row) => row.id}
        caption="Team users"
        empty={
          <EmptyState
            title="No users yet"
            description="Add a Builder or Viewer to get started."
            action={
              <button type="button" className="ui-btn" onClick={() => setDialog({ type: "add" })}>
                Add user
              </button>
            }
          />
        }
      />

      {/* Add user — form dialog using shared dialog styles */}
      {dialog?.type === "add" ? (
        <div className="ui-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            className="ui-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-user-title" className="ui-dialog__title">
              Add user
            </h2>
            <form className="users-dialog-form" onSubmit={onAddUser}>
              {formError ? (
                <p className="users-page__alert" role="alert">
                  {formError}
                </p>
              ) : null}
              <FormField name="username" label="Username" required errors={fieldErrors}>
                <input
                  id="username"
                  name="username"
                  className="ui-input"
                  required
                  disabled={pending}
                />
              </FormField>
              <FormField name="displayName" label="Display name" required errors={fieldErrors}>
                <input
                  id="displayName"
                  name="displayName"
                  className="ui-input"
                  required
                  disabled={pending}
                />
              </FormField>
              <FormField name="role" label="Role" required errors={fieldErrors}>
                <select
                  id="role"
                  name="role"
                  className="ui-input"
                  defaultValue="viewer"
                  disabled={pending}
                >
                  <option value="viewer">Viewer</option>
                  <option value="builder">Builder</option>
                </select>
              </FormField>
              <FormField name="email" label="Email" errors={fieldErrors}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="ui-input"
                  disabled={pending}
                />
              </FormField>
              <FormField name="phone" label="Phone" errors={fieldErrors}>
                <input id="phone" name="phone" className="ui-input" disabled={pending} />
              </FormField>
              <div className="ui-dialog__actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  onClick={closeDialog}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button type="submit" className="ui-btn" disabled={pending}>
                  {pending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog?.type === "deactivate"}
        title="Deactivate user?"
        description={
          dialog?.type === "deactivate" ? (
            <>
              {formError ? (
                <p className="users-page__alert" role="alert">
                  {formError}
                </p>
              ) : null}
              <p>
                {dialog.user.displayName} ({dialog.user.username}) will no longer be able to sign
                in.
              </p>
            </>
          ) : null
        }
        confirmLabel="Deactivate"
        danger
        busy={pending}
        onConfirm={onConfirmDeactivate}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.type === "reactivate"}
        title="Reactivate user?"
        description={
          dialog?.type === "reactivate" ? (
            <>
              {formError ? (
                <p className="users-page__alert" role="alert">
                  {formError}
                </p>
              ) : null}
              <p>
                Restore sign-in for {dialog.user.displayName} ({dialog.user.username}).
              </p>
            </>
          ) : null
        }
        confirmLabel="Reactivate"
        busy={pending}
        onConfirm={onConfirmReactivate}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.type === "reset"}
        title="Issue temporary password?"
        description={
          dialog?.type === "reset" ? (
            <>
              {formError ? (
                <p className="users-page__alert" role="alert">
                  {formError}
                </p>
              ) : null}
              <p>
                {dialog.user.displayName} will be forced to change password on next sign-in. Show
                the temporary password once.
              </p>
            </>
          ) : null
        }
        confirmLabel="Issue password"
        busy={pending}
        onConfirm={onConfirmReset}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.type === "temp"}
        title="Temporary password"
        description={
          dialog?.type === "temp" ? (
            <>
              <p>
                Copy this password for <strong>{dialog.username}</strong>. It will not be shown
                again.
              </p>
              <p className="users-page__temp">{dialog.password}</p>
            </>
          ) : null
        }
        confirmLabel="Done"
        cancelLabel="Close"
        busy={false}
        onConfirm={closeDialog}
        onCancel={closeDialog}
      />

      {/* Transfer Admin */}
      {dialog?.type === "transfer" ? (
        <div className="ui-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            className="ui-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-admin-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="transfer-admin-title" className="ui-dialog__title">
              Transfer Admin
            </h2>
            <div className="ui-dialog__body">
              {formError ? (
                <p className="users-page__alert" role="alert">
                  {formError}
                </p>
              ) : null}
              <p>
                You will become a Builder. Exactly one Admin remains. Choose an active Builder or
                Viewer.
              </p>
              <FormField name="newAdminUserId" label="New Admin" required>
                <select
                  id="newAdminUserId"
                  className="ui-input"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  disabled={pending || transferCandidates.length === 0}
                >
                  <option value="">Select a user…</option>
                  {transferCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.username}) · {u.role}
                    </option>
                  ))}
                </select>
              </FormField>
              {transferCandidates.length === 0 ? (
                <p className="ui-hint">
                  Add an active Builder or Viewer before transferring Admin.
                </p>
              ) : null}
            </div>
            <div className="ui-dialog__actions">
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                onClick={closeDialog}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                onClick={onConfirmTransfer}
                disabled={pending || !transferTargetId}
              >
                {pending ? "Transferring…" : "Transfer Admin"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

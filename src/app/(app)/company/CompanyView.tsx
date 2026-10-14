"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  companyAddBankAction,
  companyDeactivateBankAction,
  companyEditBankAction,
  companySetDefaultBankAction,
  companyUpdateAction,
} from "@/actions/company";
import { actionErrorMessage } from "@/lib/action-errors";
import type {
  ClientBankAccount,
  ClientCompanyProfile,
  ClientCompanySummary,
} from "@/lib/company-dto";
import type { AppRole } from "@/lib/nav";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { ConfirmDialog, EmptyState, StatusChip } from "@/components/ui";
import "../profile/profile.css";

type CompanyViewProps = {
  role: AppRole;
  profile: ClientCompanyProfile;
  summary: ClientCompanySummary;
  banks: ClientBankAccount[] | null;
  banksDenied: boolean;
};

type BankDialog =
  | { type: "add" }
  | { type: "edit"; bank: ClientBankAccount }
  | { type: "deactivate"; bank: ClientBankAccount }
  | null;

function maskAccount(num: string): string {
  if (num.length <= 4) return num;
  return `••••${num.slice(-4)}`;
}

function defaultNotes(defaults: Record<string, unknown>): string {
  const v = defaults.notes ?? defaults.paymentTerms;
  return typeof v === "string" ? v : "";
}

export function CompanyView({
  role,
  profile: initialProfile,
  summary,
  banks: initialBanks,
  banksDenied,
}: CompanyViewProps) {
  const router = useRouter();
  const canEdit = role === "admin";
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState(initialProfile);
  const [banks, setBanks] = useState<ClientBankAccount[]>(initialBanks ?? []);
  const [formErrors, setFormErrors] = useState<FieldErrors | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<BankDialog>(null);
  const [dialogErrors, setDialogErrors] = useState<FieldErrors | null>(null);

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setDialogErrors(null);
  }

  function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setFormErrors(null);
    setFormMsg(null);
    const data = new FormData(e.currentTarget);
    const notes = String(data.get("invoiceNotes") ?? "").trim();
    const panRaw = String(data.get("pan") ?? "").trim();
    const payload = {
      legalName: String(data.get("legalName") ?? "").trim(),
      gstin: String(data.get("gstin") ?? "").trim() || null,
      pan: panRaw.length === 0 ? null : panRaw,
      invoiceDefaults: {
        ...profile.invoiceDefaults,
        notes: notes || undefined,
      },
    };

    startTransition(async () => {
      try {
        const updated = await companyUpdateAction(payload);
        setProfile({
          legalName: updated.legalName,
          gstin: updated.gstin,
          pan: updated.pan,
          invoiceDefaults: updated.invoiceDefaults,
          updatedAt: updated.updatedAt,
        });
        setFormMsg("Company profile saved.");
        router.refresh();
      } catch (err) {
        const message = actionErrorMessage(err, "Could not save company profile.");
        setFormErrors(fieldErrorsFromServer({ error: message }));
      }
    });
  }

  function onAddOrEditBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit || !dialog || (dialog.type !== "add" && dialog.type !== "edit")) return;
    setDialogErrors(null);
    const data = new FormData(e.currentTarget);
    const payload = {
      label: String(data.get("label") ?? "").trim(),
      bankName: String(data.get("bankName") ?? "").trim(),
      accountHolder: String(data.get("accountHolder") ?? "").trim(),
      branch: String(data.get("branch") ?? "").trim() || null,
      accountNumber: String(data.get("accountNumber") ?? "").trim(),
      ifsc: String(data.get("ifsc") ?? "").trim(),
      ...(dialog.type === "add" ? { isDefault: data.get("isDefault") === "on" } : {}),
    };

    startTransition(async () => {
      try {
        if (dialog.type === "add") {
          const created = await companyAddBankAction(payload);
          setBanks((prev) => {
            const next = [...prev, created as ClientBankAccount];
            if (created.isDefault) {
              return next.map((b) =>
                b.id === created.id ? { ...b, isDefault: true } : { ...b, isDefault: false },
              );
            }
            return next;
          });
        } else {
          const editPayload = {
            label: payload.label,
            bankName: payload.bankName,
            accountHolder: payload.accountHolder,
            branch: payload.branch,
            ...(payload.accountNumber ? { accountNumber: payload.accountNumber } : {}),
            ...(payload.ifsc ? { ifsc: payload.ifsc } : {}),
          };
          const updated = await companyEditBankAction(dialog.bank.id, editPayload);
          setBanks((prev) =>
            prev.map((b) => (b.id === updated.id ? (updated as ClientBankAccount) : b)),
          );
        }
        setDialog(null);
        setBankError(null);
        router.refresh();
      } catch (err) {
        const message = actionErrorMessage(err, "Could not save bank account.");
        setDialogErrors(fieldErrorsFromServer({ error: message }));
      }
    });
  }

  function onDeactivateBank() {
    if (!dialog || dialog.type !== "deactivate") return;
    const id = dialog.bank.id;
    startTransition(async () => {
      try {
        const updated = await companyDeactivateBankAction(id);
        setBanks((prev) =>
          prev.map((b) => (b.id === updated.id ? (updated as ClientBankAccount) : b)),
        );
        setDialog(null);
        router.refresh();
      } catch (err) {
        setBankError(actionErrorMessage(err, "Could not deactivate bank account."));
        setDialog(null);
      }
    });
  }

  function onSetDefault(id: string) {
    startTransition(async () => {
      try {
        const updated = await companySetDefaultBankAction(id);
        setBanks((prev) =>
          prev.map((b) => ({
            ...b,
            isDefault: b.id === updated.id,
          })),
        );
        setBankError(null);
        router.refresh();
      } catch (err) {
        setBankError(actionErrorMessage(err, "Could not set default bank."));
      }
    });
  }

  const activeBanks = banks.filter((b) => b.isActive);

  return (
    <div className="profile-page">
      <ProfileTabs active="company" />

      <div className="profile-page__intro">
        <h2>Company profile</h2>
        <p>
          {canEdit
            ? "Legal details and bank accounts for invoices. Only Admins can edit."
            : "Shared company details. Bank accounts are visible to Admins and Builders."}
        </p>
      </div>

      <section className="profile-section" aria-labelledby="company-summary-heading">
        <h3 id="company-summary-heading" className="profile-section__title">
          Workspace
        </h3>
        <dl className="profile-dl">
          <dt>Current Admin</dt>
          <dd>
            {summary.admin ? `${summary.admin.displayName} (@${summary.admin.username})` : "—"}
          </dd>
          <dt>Role counts</dt>
          <dd>
            Admin {summary.roleCounts.admin} · Builder {summary.roleCounts.builder} · Viewer{" "}
            {summary.roleCounts.viewer}
          </dd>
        </dl>
      </section>

      <section className="profile-section" aria-labelledby="company-details-heading">
        <h3 id="company-details-heading" className="profile-section__title">
          Legal details
        </h3>
        {canEdit ? (
          <form className="profile-form" onSubmit={onSaveProfile} noValidate>
            {formErrors?._form ? (
              <p className="profile-alert profile-alert--error" role="alert">
                {formErrors._form}
              </p>
            ) : null}
            {formMsg ? (
              <p className="profile-alert profile-alert--ok" role="status">
                {formMsg}
              </p>
            ) : null}

            <FormField name="legalName" label="Legal name" required errors={formErrors}>
              <input
                id="legalName"
                name="legalName"
                className="ui-input"
                defaultValue={profile.legalName}
                required
                disabled={pending}
                aria-invalid={formErrors?.legalName ? true : undefined}
              />
            </FormField>

            <div className="profile-form__row">
              <FormField name="gstin" label="GSTIN" errors={formErrors}>
                <input
                  id="gstin"
                  name="gstin"
                  className="ui-input"
                  defaultValue={profile.gstin ?? ""}
                  maxLength={15}
                  disabled={pending}
                  aria-invalid={formErrors?.gstin ? true : undefined}
                />
              </FormField>
              <FormField
                name="pan"
                label="PAN"
                errors={formErrors}
                hint="Encrypted at rest. Leave blank to clear."
              >
                <input
                  id="pan"
                  name="pan"
                  className="ui-input"
                  defaultValue={profile.pan ?? ""}
                  autoComplete="off"
                  disabled={pending}
                  aria-invalid={formErrors?.pan ? true : undefined}
                />
              </FormField>
            </div>

            <FormField
              name="invoiceNotes"
              label="Invoice defaults (notes)"
              hint="Optional default text for new invoices."
            >
              <textarea
                id="invoiceNotes"
                name="invoiceNotes"
                className="ui-input"
                rows={3}
                defaultValue={defaultNotes(profile.invoiceDefaults)}
                disabled={pending}
              />
            </FormField>

            <div className="profile-form__actions">
              <button type="submit" className="ui-btn" disabled={pending}>
                {pending ? "Saving…" : "Save company profile"}
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile-dl">
            <dt>Legal name</dt>
            <dd>{profile.legalName || "—"}</dd>
            <dt>GSTIN</dt>
            <dd>{profile.gstin || "—"}</dd>
            <dt>Invoice notes</dt>
            <dd>{defaultNotes(profile.invoiceDefaults) || "—"}</dd>
          </dl>
        )}
      </section>

      <section className="profile-section" aria-labelledby="company-banks-heading">
        <h3 id="company-banks-heading" className="profile-section__title">
          Bank accounts
        </h3>
        {banksDenied ? (
          <p className="profile-coming-later">
            Bank details are hidden from Viewers. Ask an Admin if you need account information.
          </p>
        ) : (
          <>
            <p className="profile-section__lede">
              {canEdit
                ? "Add, edit, deactivate, and set a default account for invoices."
                : "Read-only. Account numbers are shown in full for Builders."}
            </p>
            {bankError ? (
              <p className="profile-alert profile-alert--error" role="alert">
                {bankError}
              </p>
            ) : null}
            {canEdit ? (
              <div className="profile-form__actions">
                <button
                  type="button"
                  className="ui-btn"
                  disabled={pending}
                  onClick={() => setDialog({ type: "add" })}
                >
                  Add bank account
                </button>
              </div>
            ) : null}
            {activeBanks.length === 0 ? (
              <EmptyState
                title="No bank accounts"
                description={
                  canEdit ? "Add an account to show on invoices." : "No active bank accounts yet."
                }
              />
            ) : (
              <ul className="profile-bank-list">
                {activeBanks.map((bank) => (
                  <li key={bank.id} className="profile-bank">
                    <div className="profile-bank__header">
                      <div>
                        <strong>{bank.label}</strong>
                        {bank.isDefault ? (
                          <>
                            {" "}
                            <StatusChip tone="success">Default</StatusChip>
                          </>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <div className="profile-bank__actions">
                          {!bank.isDefault ? (
                            <button
                              type="button"
                              className="ui-btn ui-btn--ghost"
                              disabled={pending}
                              onClick={() => onSetDefault(bank.id)}
                            >
                              Set default
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="ui-btn ui-btn--ghost"
                            disabled={pending}
                            onClick={() => setDialog({ type: "edit", bank })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ui-btn ui-btn--ghost ui-btn--danger"
                            disabled={pending}
                            onClick={() => setDialog({ type: "deactivate", bank })}
                          >
                            Deactivate
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <dl className="profile-bank__fields">
                      <dt>Bank</dt>
                      <dd>{bank.bankName}</dd>
                      <dt>Holder</dt>
                      <dd>{bank.accountHolder}</dd>
                      {bank.branch ? (
                        <>
                          <dt>Branch</dt>
                          <dd>{bank.branch}</dd>
                        </>
                      ) : null}
                      <dt>Account</dt>
                      <dd className="profile-mono">
                        {canEdit || role === "builder"
                          ? bank.accountNumber
                          : maskAccount(bank.accountNumber)}
                      </dd>
                      <dt>IFSC</dt>
                      <dd className="profile-mono">{bank.ifsc}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={dialog?.type === "deactivate"}
        title="Deactivate bank account?"
        description={
          dialog?.type === "deactivate"
            ? `${dialog.bank.label} will no longer appear as an active account.`
            : undefined
        }
        confirmLabel="Deactivate"
        danger
        busy={pending}
        onConfirm={onDeactivateBank}
        onCancel={closeDialog}
      />

      {dialog?.type === "add" || dialog?.type === "edit" ? (
        <div className="ui-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            className="ui-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="bank-dialog-title" className="ui-dialog__title">
              {dialog.type === "add" ? "Add bank account" : "Edit bank account"}
            </h2>
            <form className="profile-form" onSubmit={onAddOrEditBank} noValidate>
              {dialogErrors?._form ? (
                <p className="profile-alert profile-alert--error" role="alert">
                  {dialogErrors._form}
                </p>
              ) : null}
              <FormField name="label" label="Label" required errors={dialogErrors}>
                <input
                  id="label"
                  name="label"
                  className="ui-input"
                  required
                  defaultValue={dialog.type === "edit" ? dialog.bank.label : ""}
                  disabled={pending}
                />
              </FormField>
              <FormField name="bankName" label="Bank name" required errors={dialogErrors}>
                <input
                  id="bankName"
                  name="bankName"
                  className="ui-input"
                  required
                  defaultValue={dialog.type === "edit" ? dialog.bank.bankName : ""}
                  disabled={pending}
                />
              </FormField>
              <FormField name="accountHolder" label="Account holder" required errors={dialogErrors}>
                <input
                  id="accountHolder"
                  name="accountHolder"
                  className="ui-input"
                  required
                  defaultValue={dialog.type === "edit" ? dialog.bank.accountHolder : ""}
                  disabled={pending}
                />
              </FormField>
              <FormField name="branch" label="Branch" errors={dialogErrors}>
                <input
                  id="branch"
                  name="branch"
                  className="ui-input"
                  defaultValue={dialog.type === "edit" ? (dialog.bank.branch ?? "") : ""}
                  disabled={pending}
                />
              </FormField>
              <FormField
                name="accountNumber"
                label="Account number"
                required={dialog.type === "add"}
                errors={dialogErrors}
                hint={
                  dialog.type === "edit" ? "Leave blank to keep the current number." : undefined
                }
              >
                <input
                  id="accountNumber"
                  name="accountNumber"
                  className="ui-input"
                  required={dialog.type === "add"}
                  autoComplete="off"
                  disabled={pending}
                />
              </FormField>
              <FormField
                name="ifsc"
                label="IFSC"
                required={dialog.type === "add"}
                errors={dialogErrors}
                hint={dialog.type === "edit" ? "Leave blank to keep the current IFSC." : undefined}
              >
                <input
                  id="ifsc"
                  name="ifsc"
                  className="ui-input"
                  required={dialog.type === "add"}
                  autoComplete="off"
                  disabled={pending}
                />
              </FormField>
              {dialog.type === "add" ? (
                <label className="profile-check">
                  <input type="checkbox" name="isDefault" disabled={pending} />
                  <span>Set as default account</span>
                </label>
              ) : null}
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
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { sessionsRevokeOwnAction, usersChangeOwnPasswordAction } from "@/actions/users";
import { actionErrorMessage } from "@/lib/action-errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import type { ClientSession } from "@/lib/profile-dto";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { ConfirmDialog, EmptyState, StatusChip } from "@/components/ui";
import "../profile.css";

type PrivacyViewProps = {
  sessions: ClientSession[];
};

function formatWhen(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function deviceLabel(ua: string | null): string {
  if (!ua || ua.trim().length === 0) return "Unknown device";
  const trimmed = ua.trim();
  return trimmed.length > 96 ? `${trimmed.slice(0, 93)}…` : trimmed;
}

export function PrivacyView({ sessions: initialSessions }: PrivacyViewProps) {
  const router = useRouter();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [revokePending, startRevokeTransition] = useTransition();
  const [sessions, setSessions] = useState(initialSessions);
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.revokedAt == null);

  function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordErrors(null);
    setPasswordMsg(null);
    const data = new FormData(e.currentTarget);
    const oldPassword = String(data.get("oldPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordErrors({
        newPassword: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    startPasswordTransition(async () => {
      try {
        await usersChangeOwnPasswordAction({ oldPassword, newPassword });
        setPasswordMsg("Password updated. Other devices were signed out.");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } catch (err) {
        const message = actionErrorMessage(err, "Could not change password.");
        setPasswordErrors(fieldErrorsFromServer({ error: message }));
      }
    });
  }

  function onConfirmRevoke() {
    if (!revokeId) return;
    const id = revokeId;
    startRevokeTransition(async () => {
      try {
        await sessionsRevokeOwnAction(id);
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s)),
        );
        setRevokeId(null);
        setDevicesError(null);
        router.refresh();
      } catch (err) {
        setDevicesError(actionErrorMessage(err, "Could not revoke session."));
        setRevokeId(null);
      }
    });
  }

  return (
    <div className="profile-page">
      <div className="profile-page__intro">
        <h2>Privacy</h2>
        <p>Password, signed-in devices, and sign-in security for your account.</p>
      </div>

      <section className="profile-panel" aria-labelledby="privacy-password-heading">
        <h3 id="privacy-password-heading" className="profile-panel__title">
          Password
        </h3>
        <p className="profile-panel__lede">
          Updating your password signs out other devices. This device stays signed in.
        </p>
        <form className="profile-form" onSubmit={onChangePassword} noValidate>
          {passwordErrors?._form ? (
            <p className="profile-alert profile-alert--error" role="alert">
              {passwordErrors._form}
            </p>
          ) : null}
          {passwordMsg ? (
            <p className="profile-alert profile-alert--ok" role="status">
              {passwordMsg}
            </p>
          ) : null}

          <FormField name="oldPassword" label="Current password" required errors={passwordErrors}>
            <input
              id="oldPassword"
              name="oldPassword"
              type="password"
              className="ui-input"
              autoComplete="current-password"
              required
              disabled={passwordPending}
              aria-invalid={passwordErrors?.oldPassword ? true : undefined}
            />
          </FormField>
          <FormField
            name="newPassword"
            label="New password"
            required
            errors={passwordErrors}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          >
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="ui-input"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              disabled={passwordPending}
              aria-invalid={passwordErrors?.newPassword ? true : undefined}
            />
          </FormField>
          <FormField
            name="confirmPassword"
            label="Confirm new password"
            required
            errors={passwordErrors}
          >
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="ui-input"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              disabled={passwordPending}
              aria-invalid={passwordErrors?.confirmPassword ? true : undefined}
            />
          </FormField>
          <div className="profile-form__actions">
            <button type="submit" className="ui-btn" disabled={passwordPending}>
              {passwordPending ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-panel" aria-labelledby="privacy-devices-heading">
        <h3 id="privacy-devices-heading" className="profile-panel__title">
          Signed-in devices
        </h3>
        <p className="profile-panel__lede">Revoke a session to sign that device out immediately.</p>
        {devicesError ? (
          <p className="profile-alert profile-alert--error" role="alert">
            {devicesError}
          </p>
        ) : null}
        {activeSessions.length === 0 ? (
          <EmptyState title="No active sessions" description="You are not signed in elsewhere." />
        ) : (
          <ul className="profile-device-list">
            {activeSessions.map((session) => (
              <li key={session.id} className="profile-device">
                <div className="profile-device__meta">
                  <span className="profile-device__ua">{deviceLabel(session.userAgent)}</span>
                  <span className="profile-device__sub">
                    Last seen {formatWhen(session.lastSeenAt)}
                    {session.ip ? ` · ${session.ip}` : ""}
                    {session.isCurrent ? " · This device" : ""}
                  </span>
                </div>
                {session.isCurrent ? (
                  <StatusChip tone="success">Current</StatusChip>
                ) : (
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--danger"
                    disabled={revokePending}
                    onClick={() => setRevokeId(session.id)}
                    aria-label={`Revoke session last seen ${formatWhen(session.lastSeenAt)}`}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-panel" aria-labelledby="privacy-2fa-heading">
        <h3 id="privacy-2fa-heading" className="profile-panel__title">
          Two-step sign-in
        </h3>
        <p className="profile-coming-later">Coming later — password-only sign-in for Release 1.</p>
      </section>

      <ConfirmDialog
        open={revokeId !== null}
        title="Revoke this device?"
        description="That session will be signed out immediately. You can sign in again from that device later."
        confirmLabel="Revoke"
        danger
        busy={revokePending}
        onConfirm={onConfirmRevoke}
        onCancel={() => {
          if (!revokePending) setRevokeId(null);
        }}
      />
    </div>
  );
}

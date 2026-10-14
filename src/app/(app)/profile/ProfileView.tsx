"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  sessionsRevokeOwnAction,
  usersChangeOwnPasswordAction,
  usersUpdateOwnProfileAction,
} from "@/actions/users";
import { actionErrorMessage } from "@/lib/action-errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import {
  parseReminderPrefs,
  type ClientSession,
  type ProfileUser,
  type ReminderPrefsForm,
} from "@/lib/profile-dto";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { ConfirmDialog, EmptyState, StatusChip } from "@/components/ui";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import "./profile.css";

type ProfileViewProps = {
  user: ProfileUser;
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

export function ProfileView({ user, sessions: initialSessions }: ProfileViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState(user);
  const [sessions, setSessions] = useState(initialSessions);
  const [prefs, setPrefs] = useState<ReminderPrefsForm>(() => parseReminderPrefs(user.prefs));

  const [detailsErrors, setDetailsErrors] = useState<FieldErrors | null>(null);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.revokedAt == null);

  function onSaveDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDetailsErrors(null);
    setDetailsMsg(null);
    const data = new FormData(e.currentTarget);
    const payload = {
      displayName: String(data.get("displayName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim() || null,
      phone: String(data.get("phone") ?? "").trim() || null,
    };
    startTransition(async () => {
      try {
        const updated = await usersUpdateOwnProfileAction(payload);
        setProfile({
          ...profile,
          displayName: updated.displayName,
          email: updated.email,
          phone: updated.phone,
          prefs: updated.prefs ?? profile.prefs,
        });
        setDetailsMsg("Profile saved.");
        router.refresh();
      } catch (err) {
        const message = actionErrorMessage(err, "Could not save profile.");
        setDetailsErrors(fieldErrorsFromServer({ error: message }));
      }
    });
  }

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

    startTransition(async () => {
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

  function onSavePrefs(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPrefsMsg(null);
    setPrefsError(null);
    const data = new FormData(e.currentTarget);
    const next: ReminderPrefsForm = {
      waitingEnabled: data.get("waitingEnabled") === "on",
      dueSoonEnabled: data.get("dueSoonEnabled") === "on",
      waitingDays: Math.max(1, Number(data.get("waitingDays")) || prefs.waitingDays),
      dueSoonDays: Math.max(1, Number(data.get("dueSoonDays")) || prefs.dueSoonDays),
    };
    startTransition(async () => {
      try {
        const updated = await usersUpdateOwnProfileAction({
          prefs: { reminders: next },
        });
        setPrefs(parseReminderPrefs(updated.prefs ?? { reminders: next }));
        setPrefsMsg("Preferences saved.");
        router.refresh();
      } catch (err) {
        setPrefsError(actionErrorMessage(err, "Could not save preferences."));
      }
    });
  }

  function onConfirmRevoke() {
    if (!revokeId) return;
    const id = revokeId;
    startTransition(async () => {
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
      <ProfileTabs active="me" />

      <div className="profile-page__intro">
        <h2>My profile</h2>
        <p>Your details, password, signed-in devices, and in-app reminder preferences.</p>
      </div>

      <section className="profile-section" aria-labelledby="profile-details-heading">
        <h3 id="profile-details-heading" className="profile-section__title">
          Details
        </h3>
        <p className="profile-section__lede">Username is fixed. Photo upload comes later.</p>

        <dl className="profile-dl">
          <dt>Username</dt>
          <dd>
            <span className="profile-mono">{profile.username}</span>
          </dd>
          <dt>Role</dt>
          <dd>
            <StatusChip tone={profile.role === "admin" ? "warning" : "neutral"}>
              {profile.role}
            </StatusChip>
          </dd>
          <dt>Photo</dt>
          <dd>
            <span
              className="profile-coming-later"
              style={{ display: "inline-block", padding: 0, border: 0 }}
            >
              Coming later
            </span>
          </dd>
        </dl>

        <form className="profile-form" onSubmit={onSaveDetails} noValidate>
          {detailsErrors?._form ? (
            <p className="profile-alert profile-alert--error" role="alert">
              {detailsErrors._form}
            </p>
          ) : null}
          {detailsMsg ? (
            <p className="profile-alert profile-alert--ok" role="status">
              {detailsMsg}
            </p>
          ) : null}

          <FormField name="displayName" label="Display name" required errors={detailsErrors}>
            <input
              id="displayName"
              name="displayName"
              className="ui-input"
              defaultValue={profile.displayName}
              required
              disabled={pending}
              autoComplete="name"
              aria-invalid={detailsErrors?.displayName ? true : undefined}
            />
          </FormField>

          <div className="profile-form__row">
            <FormField name="email" label="Email" errors={detailsErrors}>
              <input
                id="email"
                name="email"
                type="email"
                className="ui-input"
                defaultValue={profile.email ?? ""}
                disabled={pending}
                autoComplete="email"
                aria-invalid={detailsErrors?.email ? true : undefined}
              />
            </FormField>
            <FormField name="phone" label="Phone" errors={detailsErrors}>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="ui-input"
                defaultValue={profile.phone ?? ""}
                disabled={pending}
                autoComplete="tel"
                aria-invalid={detailsErrors?.phone ? true : undefined}
              />
            </FormField>
          </div>

          <div className="profile-form__actions">
            <button type="submit" className="ui-btn" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-password-heading">
        <h3 id="profile-password-heading" className="profile-section__title">
          Change password
        </h3>
        <p className="profile-section__lede">
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
              disabled={pending}
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
              disabled={pending}
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
              disabled={pending}
              aria-invalid={passwordErrors?.confirmPassword ? true : undefined}
            />
          </FormField>
          <div className="profile-form__actions">
            <button type="submit" className="ui-btn" disabled={pending}>
              {pending ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-devices-heading">
        <h3 id="profile-devices-heading" className="profile-section__title">
          Signed-in devices
        </h3>
        <p className="profile-section__lede">
          Revoke a session to sign that device out immediately.
        </p>
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
                    disabled={pending}
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

      <section className="profile-section" aria-labelledby="profile-prefs-heading">
        <h3 id="profile-prefs-heading" className="profile-section__title">
          Preferences
        </h3>
        <p className="profile-section__lede">
          In-app reminders for waiting steps and payment due soon. Email reminders: coming later.
        </p>
        <form className="profile-form" onSubmit={onSavePrefs}>
          {prefsError ? (
            <p className="profile-alert profile-alert--error" role="alert">
              {prefsError}
            </p>
          ) : null}
          {prefsMsg ? (
            <p className="profile-alert profile-alert--ok" role="status">
              {prefsMsg}
            </p>
          ) : null}

          <label className="profile-check">
            <input
              type="checkbox"
              name="waitingEnabled"
              defaultChecked={prefs.waitingEnabled}
              disabled={pending}
            />
            <span>Remind me when a step has been waiting too long</span>
          </label>
          <FormField
            name="waitingDays"
            label="Waiting threshold (days)"
            hint="Steps open longer than this show as waiting."
          >
            <input
              id="waitingDays"
              name="waitingDays"
              type="number"
              className="ui-input"
              min={1}
              max={90}
              defaultValue={prefs.waitingDays}
              disabled={pending}
            />
          </FormField>

          <label className="profile-check">
            <input
              type="checkbox"
              name="dueSoonEnabled"
              defaultChecked={prefs.dueSoonEnabled}
              disabled={pending}
            />
            <span>Remind me when payment is due soon</span>
          </label>
          <FormField name="dueSoonDays" label="Due-soon window (days)">
            <input
              id="dueSoonDays"
              name="dueSoonDays"
              type="number"
              className="ui-input"
              min={1}
              max={90}
              defaultValue={prefs.dueSoonDays}
              disabled={pending}
            />
          </FormField>

          <div className="profile-form__actions">
            <button type="submit" className="ui-btn" disabled={pending}>
              {pending ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-2fa-heading">
        <h3 id="profile-2fa-heading" className="profile-section__title">
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
        busy={pending}
        onConfirm={onConfirmRevoke}
        onCancel={() => setRevokeId(null)}
      />
    </div>
  );
}

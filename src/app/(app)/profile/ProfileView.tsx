"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { usersUpdateOwnProfileAction } from "@/actions/users";
import { actionErrorMessage } from "@/lib/action-errors";
import type { ProfileUser } from "@/lib/profile-dto";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { StatusChip } from "@/components/ui";
import "./profile.css";

type ProfileViewProps = {
  user: ProfileUser;
};

export function ProfileView({ user }: ProfileViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState(user);
  const [detailsErrors, setDetailsErrors] = useState<FieldErrors | null>(null);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

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

  return (
    <div className="profile-page">
      <div className="profile-page__intro">
        <h2>My Profile</h2>
        <p>
          Your personal details for this workspace. Username is fixed; photo upload comes later.
        </p>
      </div>

      <dl className="profile-dl">
        <dt>Username</dt>
        <dd>
          <span className="profile-mono">{profile.username}</span>
        </dd>
        <dt>Role</dt>
        <dd>
          <StatusChip
            tone={
              profile.role === "admin" ? "warning" : profile.role === "builder" ? "info" : "muted"
            }
          >
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
    </div>
  );
}

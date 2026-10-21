"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { usersUpdateOwnProfileAction } from "@/actions/users";
import { actionErrorMessage } from "@/lib/action-errors";
import { parseReminderPrefs, type ReminderPrefsForm } from "@/lib/profile-dto";
import { FormField } from "@/components/forms";
import "../profile.css";

type PreferencesViewProps = {
  prefs: ReminderPrefsForm;
};

export function PreferencesView({ prefs: initialPrefs }: PreferencesViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

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

  return (
    <div className="profile-page">
      <div className="profile-page__intro">
        <h2>Preferences</h2>
        <p>In-app reminders for waiting steps and payment due soon. Email reminders come later.</p>
      </div>

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
    </div>
  );
}

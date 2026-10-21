"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { useAppNavigate } from "@/lib/navigate";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export function ChangePasswordForm() {
  const navigate = useAppNavigate();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors(null);
    setFormError(null);

    const data = new FormData(e.currentTarget);
    const oldPassword = String(data.get("oldPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setErrors({
        newPassword: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/me/password", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;

        if (!res.ok) {
          const mapped = fieldErrorsFromServer(body);
          setFormError(mapped._form ?? body?.error ?? "Could not change password.");
          setErrors(mapped);
          return;
        }

        navigate.replace("/dashboard");
        navigate.refresh();
      } catch {
        setFormError("Could not change password. Try again.");
      }
    });
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {formError ? (
        <p className="auth-form__error" role="alert">
          {formError}
        </p>
      ) : null}

      <FormField name="oldPassword" label="Current password" required errors={errors}>
        <input
          id="oldPassword"
          name="oldPassword"
          type="password"
          className="ui-input"
          autoComplete="current-password"
          required
          disabled={pending}
          aria-invalid={errors?.oldPassword ? true : undefined}
        />
      </FormField>

      <FormField
        name="newPassword"
        label="New password"
        required
        errors={errors}
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
          aria-invalid={errors?.newPassword ? true : undefined}
        />
      </FormField>

      <FormField name="confirmPassword" label="Confirm new password" required errors={errors}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="ui-input"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          disabled={pending}
          aria-invalid={errors?.confirmPassword ? true : undefined}
        />
      </FormField>

      <div className="auth-form__actions">
        <button type="submit" className="ui-btn" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

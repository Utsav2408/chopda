"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormField, fieldErrorsFromServer, type FieldErrors } from "@/components/forms";
import { useAppNavigate } from "@/lib/navigate";

type LoginFormProps = {
  nextPath: string;
};

function safeNextPath(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  return raw;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const navigate = useAppNavigate();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors(null);
    setFormError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const body = (await res.json().catch(() => null)) as {
          user?: { mustChangePassword?: boolean };
          error?: string;
        } | null;

        if (!res.ok) {
          const mapped = fieldErrorsFromServer(body);
          setFormError(mapped._form ?? body?.error ?? "Could not sign in.");
          setErrors(mapped);
          return;
        }

        const dest = body?.user?.mustChangePassword ? "/change-password" : safeNextPath(nextPath);
        navigate.replace(dest);
        navigate.refresh();
      } catch {
        setFormError("Could not sign in. Try again.");
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

      <FormField name="username" label="Username" required errors={errors}>
        <input
          id="username"
          name="username"
          className="ui-input"
          autoComplete="username"
          required
          disabled={pending}
          aria-invalid={errors?.username ? true : undefined}
        />
      </FormField>

      <FormField name="password" label="Password" required errors={errors}>
        <input
          id="password"
          name="password"
          type="password"
          className="ui-input"
          autoComplete="current-password"
          required
          disabled={pending}
          aria-invalid={errors?.password ? true : undefined}
        />
      </FormField>

      <div className="auth-form__actions">
        <button type="submit" className="ui-btn" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>

      <p className="auth-form__note">
        No self-registration — accounts are issued by an Admin. Forgot your password? Ask your Admin
        to issue a temporary password reset.
      </p>
    </form>
  );
}

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useAppNavigate } from "@/lib/navigate";

export type SignOutButtonProps = {
  className?: string;
  icon?: ReactNode;
  /** Menu-row layout for the account dropdown. */
  variant?: "button" | "menu";
  onSignedOut?: () => void;
};

export function SignOutButton({
  className,
  icon,
  variant = "button",
  onSignedOut,
}: SignOutButtonProps) {
  const navigate = useAppNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSignOut() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setError("Could not sign out. Try again.");
          return;
        }
        onSignedOut?.();
        navigate.replace("/login");
        navigate.refresh();
      } catch {
        setError("Could not sign out. Try again.");
      }
    });
  }

  const label = pending ? "Signing out…" : "Sign out";

  return (
    <div className={variant === "menu" ? "user-menu__sign-out" : undefined}>
      <button
        type="button"
        role={variant === "menu" ? "menuitem" : undefined}
        className={className ?? "ui-btn ui-btn--ghost"}
        onClick={onSignOut}
        disabled={pending}
        title={label}
        aria-label={label}
      >
        {icon}
        <span>{label}</span>
      </button>
      {error ? (
        <p className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

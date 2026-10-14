"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SignOutButton() {
  const router = useRouter();
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
        router.replace("/login");
        router.refresh();
      } catch {
        setError("Could not sign out. Try again.");
      }
    });
  }

  return (
    <div>
      <button type="button" className="ui-btn ui-btn--ghost" onClick={onSignOut} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

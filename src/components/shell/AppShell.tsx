"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { RemindersBell } from "@/components/reminders/RemindersBell";
import { navForRole, type AppRole } from "@/lib/nav";
import { SignOutButton } from "./SignOutButton";
import "./shell.css";

export type AppShellProps = {
  role: AppRole;
  displayName: string;
  children: ReactNode;
};

function titleFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppShell({ role, displayName, children }: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();
  const items = navForRole(role);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className="app-shell" data-nav-open={navOpen ? "true" : "false"}>
      <button
        type="button"
        className="app-shell__overlay"
        aria-label="Close navigation"
        onClick={closeNav}
      />

      <aside id={navId} className="app-shell__sidebar" aria-label="Main">
        <div className="app-shell__brand">
          <span className="app-shell__brand-name">Chopda</span>
          <span className="app-shell__brand-meta">
            {displayName} · {role}
          </span>
        </div>

        <nav className="app-shell__nav" aria-label="Primary">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={closeNav}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-shell__footer">
          <SignOutButton />
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <button
            type="button"
            className="app-shell__menu-btn"
            aria-expanded={navOpen}
            aria-controls={navId}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className="sr-only">{navOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden="true">{navOpen ? "✕" : "☰"}</span>
          </button>
          <h1 className="app-shell__topbar-title">{titleFromPath(pathname)}</h1>
          <div className="app-shell__topbar-actions">
            <RemindersBell />
          </div>
        </header>
        <div className="app-shell__content">{children}</div>
      </div>
    </div>
  );
}

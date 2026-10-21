"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useState, type ReactNode } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconMenu,
  NavIcon,
} from "@/components/icons/Icons";
import { RemindersBell } from "@/components/reminders/RemindersBell";
import type { ReminderItemUi } from "@/lib/invoice-ui";
import { navForRole, type AppRole } from "@/lib/nav";
import { RouteProgress } from "./RouteProgress";
import { UserMenu } from "./UserMenu";
import "./shell.css";

const SIDEBAR_COLLAPSED_KEY = "chopda.sidebar-collapsed";

export type AppShellProps = {
  role: AppRole;
  displayName: string;
  initialReminders?: ReminderItemUi[];
  children: ReactNode;
};

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  flows: "Flows",
  users: "Users",
  settings: "Settings",
  company: "Company",
  profile: "My Profile",
};

function titleFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "profile" && parts[1] === "privacy") return "Privacy";
  if (parts[0] === "profile" && parts[1] === "preferences") return "Preferences";
  if (parts[0] === "profile" && parts[1] === "password") return "Privacy";
  const key = parts[0] ?? "dashboard";
  return PAGE_TITLES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function AppShell({ role, displayName, initialReminders = [], children }: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
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

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      className="app-shell"
      data-nav-open={navOpen ? "true" : "false"}
      data-sidebar-collapsed={collapsed ? "true" : "false"}
    >
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <button
        type="button"
        className="app-shell__overlay"
        aria-label="Close navigation"
        onClick={closeNav}
      />

      <div className="app-shell__frame">
        <aside id={navId} className="app-shell__sidebar" aria-label="Main">
          <div className="app-shell__brand">
            <div className="app-shell__brand-row">
              <span className="app-shell__brand-mark" aria-hidden="true">
                C
              </span>
              <div className="app-shell__brand-text">
                <span className="app-shell__brand-name">Chopda</span>
                <span className="app-shell__brand-meta">Invoice tracker</span>
              </div>
            </div>
            <button
              type="button"
              className="app-shell__collapse-btn"
              onClick={toggleCollapsed}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
              {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
            </button>
          </div>

          <nav className="app-shell__nav" aria-label="Primary">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  onClick={closeNav}
                >
                  <NavIcon id={item.icon} className="app-shell__nav-icon" />
                  <span className="app-shell__nav-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>
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
              {navOpen ? <IconClose /> : <IconMenu />}
            </button>
            <h1 className="app-shell__topbar-title">{titleFromPath(pathname)}</h1>
            <div className="app-shell__topbar-actions">
              <RemindersBell initialItems={initialReminders ?? []} />
              <UserMenu role={role} displayName={displayName} />
            </div>
          </header>
          <div className="app-shell__content">{children}</div>
        </div>
      </div>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <p className="app-shell__footer-brand">
            <span className="app-shell__footer-name">Chopda</span>
            <span className="app-shell__footer-sep" aria-hidden="true">
              ·
            </span>
            <span>Invoice tracker</span>
          </p>
          <p className="app-shell__footer-copy">
            © {new Date().getFullYear()} Chopda. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

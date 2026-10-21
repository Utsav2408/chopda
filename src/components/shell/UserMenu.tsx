"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  IconChevronRight,
  IconCompany,
  IconLock,
  IconPrefs,
  IconProfile,
  IconSettings,
  IconSignOut,
} from "@/components/icons/Icons";
import type { AppRole } from "@/lib/nav";
import { SignOutButton } from "./SignOutButton";

export type UserMenuProps = {
  role: AppRole;
  displayName: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const ACCOUNT_LINKS = [
  {
    href: "/profile",
    label: "My Profile",
    hint: "Your details",
    icon: IconProfile,
  },
  {
    href: "/company",
    label: "Company",
    hint: "Company details",
    icon: IconCompany,
  },
  {
    href: "/profile/privacy",
    label: "Privacy",
    hint: "Password & devices",
    icon: IconLock,
  },
  {
    href: "/profile/preferences",
    label: "Preferences",
    hint: "Reminders & options",
    icon: IconPrefs,
  },
] as const;

export function UserMenu({ role, displayName }: UserMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const showSettings = role === "admin";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initials(displayName)}
        </span>
        <span className="user-menu__trigger-text">
          <span className="user-menu__name">{displayName}</span>
          <span className="user-menu__role">{role}</span>
        </span>
        <IconChevronRight className="user-menu__chevron" />
      </button>

      {open ? (
        <div id={menuId} className="user-menu__panel" role="menu" aria-label="Account">
          <div className="user-menu__header">
            <span className="user-menu__avatar user-menu__avatar--lg" aria-hidden="true">
              {initials(displayName)}
            </span>
            <div className="user-menu__header-text">
              <span className="user-menu__name">{displayName}</span>
              <span className="user-menu__role">{role}</span>
            </div>
          </div>

          <div className="user-menu__list">
            {ACCOUNT_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="user-menu__item"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="user-menu__item-icon" />
                  <span>
                    {item.label}
                    <span className="user-menu__item-hint">{item.hint}</span>
                  </span>
                </Link>
              );
            })}

            {showSettings ? (
              <Link
                href="/settings"
                role="menuitem"
                className="user-menu__item"
                onClick={() => setOpen(false)}
              >
                <IconSettings className="user-menu__item-icon" />
                <span>Settings</span>
              </Link>
            ) : null}

            <div className="user-menu__divider" role="separator" />

            <SignOutButton
              className="user-menu__item user-menu__item--danger"
              icon={<IconSignOut className="user-menu__item-icon" />}
              variant="menu"
              onSignedOut={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

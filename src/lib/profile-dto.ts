/** Client-safe profile / session shapes (U5-01). */

export type ProfileUser = {
  id: string;
  username: string;
  role: "admin" | "builder" | "viewer";
  displayName: string;
  email: string | null;
  phone: string | null;
  photoObjectKey: string | null;
  prefs?: Record<string, unknown> | null;
};

export type ClientSession = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string | Date;
  lastSeenAt: string | Date;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
  isCurrent: boolean;
};

export type ReminderPrefsForm = {
  waitingEnabled: boolean;
  dueSoonEnabled: boolean;
  dueSoonDays: number;
  waitingDays: number;
};

export function parseReminderPrefs(raw: unknown): ReminderPrefsForm {
  const defaults: ReminderPrefsForm = {
    waitingEnabled: true,
    dueSoonEnabled: true,
    dueSoonDays: 7,
    waitingDays: 3,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const r = raw as Record<string, unknown>;
  const reminders =
    r.reminders && typeof r.reminders === "object" && !Array.isArray(r.reminders)
      ? (r.reminders as Record<string, unknown>)
      : r;
  return {
    waitingEnabled: reminders.waitingEnabled !== false && reminders.waiting !== false,
    dueSoonEnabled: reminders.dueSoonEnabled !== false && reminders.dueSoon !== false,
    dueSoonDays:
      typeof reminders.dueSoonDays === "number" && reminders.dueSoonDays > 0
        ? Math.floor(reminders.dueSoonDays)
        : defaults.dueSoonDays,
    waitingDays:
      typeof reminders.waitingDays === "number" && reminders.waitingDays > 0
        ? Math.floor(reminders.waitingDays)
        : defaults.waitingDays,
  };
}

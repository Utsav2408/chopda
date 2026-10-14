/**
 * In-app reminders (B7-06).
 */
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { requireRole, type AuthContext } from "../authz/index.js";
import { flowSteps, invoices, invoiceSteps, reminderState, userPreferences } from "../db/schema.js";
import { withUser, type RequestContext } from "../db/with-user.js";
import { DUE_SOON_DAYS } from "../invoices/constants.js";
import { assertCanReadInvoices } from "../invoices/service.js";
import { DEFAULT_WAITING_DAYS, daysOpen, deriveInvoiceStatus } from "../invoices/status.js";

export type ReminderKind = "waiting" | "dueSoon";

export type ReminderItem = {
  key: string;
  kind: ReminderKind;
  invoiceId: string;
  invoiceNo: string;
  partyName: string;
  /** Waiting days open, or days until due for dueSoon. */
  days: number;
  dueDate: string | null;
};

export type ReminderPrefs = {
  waitingEnabled: boolean;
  dueSoonEnabled: boolean;
  dueSoonDays: number;
  waitingDays: number;
};

const DEFAULT_PREFS: ReminderPrefs = {
  waitingEnabled: true,
  dueSoonEnabled: true,
  dueSoonDays: DUE_SOON_DAYS,
  waitingDays: DEFAULT_WAITING_DAYS,
};

function parsePrefs(raw: unknown): ReminderPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_PREFS };
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
        : DUE_SOON_DAYS,
    waitingDays:
      typeof reminders.waitingDays === "number" && reminders.waitingDays > 0
        ? Math.floor(reminders.waitingDays)
        : DEFAULT_WAITING_DAYS,
  };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseIsoDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function daysUntilDue(dueDate: string, now: Date): number {
  const due = parseIsoDateOnly(dueDate);
  return Math.floor((due.getTime() - startOfUtcDay(now).getTime()) / 86_400_000);
}

export function reminderKey(kind: ReminderKind, invoiceId: string): string {
  return `${kind}:${invoiceId}`;
}

/**
 * Compute active reminders for the caller (B7-06).
 * Respects user_preferences and reminder_state dismissals.
 */
export async function compute(ctx: AuthContext, opts?: { now?: Date }): Promise<ReminderItem[]> {
  const authed = assertCanReadInvoices(ctx);
  const now = opts?.now ?? new Date();

  return withUser(authed, async (tx) => {
    const [prefsRow] = await tx
      .select({ prefs: userPreferences.prefs })
      .from(userPreferences)
      .where(eq(userPreferences.userId, authed.userId))
      .limit(1);
    const prefs = parsePrefs(prefsRow?.prefs);

    const dismissed = await tx
      .select({ reminderKey: reminderState.reminderKey })
      .from(reminderState)
      .where(and(eq(reminderState.userId, authed.userId), isNotNull(reminderState.dismissedAt)));
    const dismissedKeys = new Set(dismissed.map((d) => d.reminderKey));

    const rows = await tx
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        partyName: invoices.partyName,
        dueDate: invoices.dueDate,
        storedStatus: invoices.status,
        createdAt: invoices.createdAt,
        currentStepId: invoices.currentStepId,
      })
      .from(invoices)
      .where(isNull(invoices.deletedAt));

    if (rows.length === 0) return [];

    const allSteps = await tx
      .select({
        invoiceId: invoiceSteps.invoiceId,
        flowStepId: invoiceSteps.flowStepId,
        status: invoiceSteps.status,
        completedAt: invoiceSteps.completedAt,
        position: flowSteps.position,
      })
      .from(invoiceSteps)
      .innerJoin(flowSteps, eq(invoiceSteps.flowStepId, flowSteps.id));

    const stepsByInvoice = new Map<string, typeof allSteps>();
    for (const s of allSteps) {
      const list = stepsByInvoice.get(s.invoiceId) ?? [];
      list.push(s);
      stepsByInvoice.set(s.invoiceId, list);
    }

    const out: ReminderItem[] = [];

    for (const r of rows) {
      if (r.storedStatus === "completed" || r.storedStatus === "cancelled") continue;

      const steps = stepsByInvoice.get(r.id) ?? [];
      let openedAt: Date | null = r.createdAt;
      if (r.currentStepId) {
        const current = steps.find((s) => s.flowStepId === r.currentStepId);
        if (current) {
          const prev = steps
            .filter(
              (s) => s.position < current.position && s.status === "completed" && s.completedAt,
            )
            .sort((a, b) => b.position - a.position)[0];
          openedAt = prev?.completedAt ?? r.createdAt;
        }
      }

      const status = deriveInvoiceStatus({
        status: r.storedStatus,
        dueDate: r.dueDate,
        currentStepOpenedAt: openedAt,
        waitingDays: prefs.waitingDays,
        now,
      });

      if (prefs.waitingEnabled && status === "waiting" && openedAt) {
        const key = reminderKey("waiting", r.id);
        if (!dismissedKeys.has(key)) {
          out.push({
            key,
            kind: "waiting",
            invoiceId: r.id,
            invoiceNo: r.invoiceNo,
            partyName: r.partyName,
            days: daysOpen(openedAt, now),
            dueDate: r.dueDate,
          });
        }
      }

      if (prefs.dueSoonEnabled && r.dueDate && status !== "overdue" && status !== "completed") {
        const until = daysUntilDue(r.dueDate, now);
        if (until >= 0 && until <= prefs.dueSoonDays) {
          const key = reminderKey("dueSoon", r.id);
          if (!dismissedKeys.has(key)) {
            out.push({
              key,
              kind: "dueSoon",
              invoiceId: r.id,
              invoiceNo: r.invoiceNo,
              partyName: r.partyName,
              days: until,
              dueDate: r.dueDate,
            });
          }
        }
      }
    }

    return out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "waiting" ? -1 : 1;
      return a.days === b.days
        ? a.invoiceNo.localeCompare(b.invoiceNo)
        : a.kind === "waiting"
          ? b.days - a.days
          : a.days - b.days;
    });
  });
}

/**
 * Dismiss a reminder for the current user.
 */
export async function dismiss(ctx: AuthContext, key: string): Promise<void> {
  const authed = requireRole(ctx, "admin", "builder", "viewer");
  await withUser(authed, async (tx) => {
    await tx
      .insert(reminderState)
      .values({
        userId: authed.userId,
        reminderKey: key,
        dismissedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [reminderState.userId, reminderState.reminderKey],
        set: { dismissedAt: new Date() },
      });
  });
}

/**
 * Cron sweep: drop dismissals for invoices that are completed/cancelled/deleted (B7-10).
 */
export async function runCronSweep(ctx: RequestContext): Promise<{ cleared: number }> {
  requireRole(ctx, "admin");
  return withUser(ctx, async (tx) => {
    const states = await tx.select().from(reminderState);
    let cleared = 0;
    for (const s of states) {
      const colon = s.reminderKey.indexOf(":");
      const invoiceId = colon >= 0 ? s.reminderKey.slice(colon + 1) : null;
      if (!invoiceId) continue;
      const [inv] = await tx
        .select({ status: invoices.status, deletedAt: invoices.deletedAt })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (!inv || inv.deletedAt || inv.status === "completed" || inv.status === "cancelled") {
        await tx.delete(reminderState).where(eq(reminderState.id, s.id));
        cleared += 1;
      }
    }
    return { cleared };
  });
}

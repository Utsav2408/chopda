/**
 * Invoice status derivation (B5-06).
 *
 * Priority (highest wins):
 *   cancelled > completed > overdue > waiting > open
 *
 * - overdue: past due_date and not completed/cancelled
 * - waiting: current step has been open longer than `waitingDays` (default 3)
 * - open: otherwise (in progress, not overdue/waiting)
 */
export const DEFAULT_WAITING_DAYS = 3;

export type DerivedInvoiceStatus = "open" | "waiting" | "overdue" | "completed" | "cancelled";

export type StatusDerivationInput = {
  /** Stored status — only `completed` and `cancelled` are terminal overrides. */
  status: string;
  dueDate: string | null;
  /**
   * When the current step became open / last advanced.
   * For the first step this is typically invoice.createdAt;
   * after a completion it is the previous step's completedAt.
   */
  currentStepOpenedAt: Date | null;
  /** Clock used for boundary checks (injectable in tests). */
  now?: Date;
  /** Waiting threshold in whole days (default 3). */
  waitingDays?: number;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseIsoDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/**
 * Days the current step has been open, measured in whole UTC calendar days
 * between the open instant's UTC date and `now`'s UTC date.
 * Same calendar day → 0; next calendar day → 1.
 */
export function daysOpen(openedAt: Date, now: Date): number {
  const a = startOfUtcDay(openedAt).getTime();
  const b = startOfUtcDay(now).getTime();
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/**
 * Derive display/operational status from invoice facts.
 */
export function deriveInvoiceStatus(input: StatusDerivationInput): DerivedInvoiceStatus {
  if (input.status === "cancelled") return "cancelled";
  if (input.status === "completed") return "completed";

  const now = input.now ?? new Date();
  const waitingDays = input.waitingDays ?? DEFAULT_WAITING_DAYS;

  if (input.dueDate) {
    const due = parseIsoDateOnly(input.dueDate);
    // Overdue when today's UTC date is strictly after due_date.
    if (startOfUtcDay(now).getTime() > due.getTime()) {
      return "overdue";
    }
  }

  if (input.currentStepOpenedAt) {
    if (daysOpen(input.currentStepOpenedAt, now) > waitingDays) {
      return "waiting";
    }
  }

  return "open";
}

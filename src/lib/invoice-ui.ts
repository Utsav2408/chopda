/**
 * Client-safe invoice UI helpers and serializable shapes (U4).
 * Keep out of `@/server` so components can import freely.
 */
import type { StatusTone } from "@/components/ui/StatusChip";
import type { StepField } from "@/lib/flow-fields";

export type InvoiceStatus = "open" | "waiting" | "overdue" | "completed" | "cancelled" | string;

export type InvoiceDocumentUi = {
  id: string;
  invoiceStepId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: string;
  sha256: string;
  uploadedBy: string;
  createdAt: string | Date;
};

export type InvoiceStepUi = {
  id: string;
  flowStepId: string;
  position: number;
  stepNumber: number;
  name: string;
  allowedRole: "admin" | "builder" | "viewer";
  fields: StepField[];
  status: string;
  completedBy: string | null;
  completedAt: string | Date | null;
  data: Record<string, unknown>;
  documents: InvoiceDocumentUi[];
};

export type InvoiceDetailUi = {
  id: string;
  invoiceNo: string;
  flowVersionId: string;
  flowTemplateId: string;
  currentStepId: string | null;
  status: InvoiceStatus;
  storedStatus: string;
  partyName: string;
  amountMinor: string;
  amountRupees: string;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  ownerId: string;
  extra: Record<string, unknown>;
  createdBy: string;
  createdAt: string | Date;
  deletedAt: string | Date | null;
  steps: InvoiceStepUi[];
};

export type InvoiceListItemUi = {
  id: string;
  invoiceNo: string;
  partyName: string;
  amountRupees: string;
  currency: string;
  status: InvoiceStatus;
  ownerId: string;
  flowTemplateId: string;
  flowVersionId: string;
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepNumber: number | null;
  issueDate: string;
  dueDate: string | null;
  createdAt: string | Date;
  progress: { completed: number; total: number };
};

export type HistoryEntryUi = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  at: string | Date;
  before: unknown;
  after: unknown;
};

export type ReminderItemUi = {
  key: string;
  kind: "waiting" | "dueSoon";
  invoiceId: string;
  invoiceNo: string;
  partyName: string;
  days: number;
  dueDate: string | null;
};

export type DeletedInvoiceUi = {
  id: string;
  invoiceNo: string;
  partyName: string;
  deletedAt: string | Date;
  daysLeft: number;
};

export const INVOICE_TABS = ["all", "mine", "waiting", "overdue", "completed"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

export function statusTone(status: InvoiceStatus): StatusTone {
  switch (status) {
    case "completed":
      return "success";
    case "waiting":
      return "info";
    case "overdue":
      return "danger";
    case "cancelled":
    case "open":
      return "muted";
    default:
      return "muted";
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }
  return value.toLocaleString();
}

export function formatMoney(rupees: string, currency = "INR"): string {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return `${currency} ${rupees}`;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${rupees}`;
  }
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "invoice.create": "Invoice created",
    "invoice.update": "Invoice updated",
    "invoice.softDelete": "Invoice deleted",
    "invoice.undo": "Invoice restored",
    "invoice.step.complete": "Step completed",
    "document.upload": "Document uploaded",
    "document.view": "Document downloaded",
  };
  return map[action] ?? action;
}

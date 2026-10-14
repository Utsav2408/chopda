/**
 * Invoice services (B5-03, B5-04, B5-07).
 */
import { audit } from "../audit/write.js";
import { canSeeInvoice, requireRole, type AuthContext } from "../authz/index.js";
import type { AppTx } from "../db/client.js";
import { withUser, type RequestContext, type UserRole } from "../db/with-user.js";
import * as flowRepo from "../flows/repo.js";
import { parseFlowFields } from "../flows/schema.js";
import { assertCanStartNewInvoices } from "../flows/service.js";
import { Conflict, NotFound, Validation } from "../kernel/errors.js";
import { paiseToRupees, rupeesToPaise } from "../money/money.js";
import * as repo from "./repo.js";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./schema.js";
import { DEFAULT_WAITING_DAYS, deriveInvoiceStatus, type DerivedInvoiceStatus } from "./status.js";

const MUTATE_ROLES: UserRole[] = ["admin", "builder"];
const READ_ROLES: UserRole[] = ["admin", "builder", "viewer"];

export function assertCanMutateInvoices(ctx: AuthContext): RequestContext {
  return requireRole(ctx, ...MUTATE_ROLES);
}

export function assertCanReadInvoices(ctx: AuthContext): RequestContext {
  return requireRole(ctx, ...READ_ROLES);
}

export type InvoiceDocumentRef = {
  id: string;
  invoiceStepId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: string;
  sha256: string;
  uploadedBy: string;
  createdAt: Date;
};

export type InvoiceStepDetail = {
  id: string;
  flowStepId: string;
  position: number;
  stepNumber: number;
  name: string;
  allowedRole: UserRole;
  /** Flow step field definitions (for StepForm / complete). */
  fields: ReturnType<typeof parseFlowFields>;
  status: string;
  completedBy: string | null;
  completedAt: Date | null;
  data: Record<string, unknown>;
  documents: InvoiceDocumentRef[];
};

export type InvoiceDetail = {
  id: string;
  invoiceNo: string;
  flowVersionId: string;
  flowTemplateId: string;
  currentStepId: string | null;
  /** Stored terminal status or derived open/waiting/overdue. */
  status: DerivedInvoiceStatus;
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
  createdAt: Date;
  deletedAt: Date | null;
  steps: InvoiceStepDetail[];
};

function asExtra(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function asStepData(raw: unknown): Record<string, unknown> {
  return asExtra(raw);
}

async function resolveCurrentStepOpenedAt(
  tx: AppTx,
  invoice: repo.InvoiceRow,
  steps: Awaited<ReturnType<typeof repo.listInvoiceStepsWithFlow>>,
): Promise<Date | null> {
  if (!invoice.currentStepId) return null;
  const current = steps.find((s) => s.flowStepId === invoice.currentStepId);
  if (!current) return invoice.createdAt;

  // Opened when previous step completed, else at invoice creation.
  const prev = steps
    .filter((s) => s.position < current.position && s.status === "completed")
    .sort((a, b) => b.position - a.position)[0];
  return prev?.completedAt ?? invoice.createdAt;
}

/** Build invoice detail from an open tx (used by invoices + steps services). */
export async function buildDetail(tx: AppTx, invoice: repo.InvoiceRow): Promise<InvoiceDetail> {
  const version = await flowRepo.getVersionById(tx, invoice.flowVersionId);
  if (!version) throw new NotFound();

  const steps = await repo.listInvoiceStepsWithFlow(tx, invoice.id);
  const docs = await repo.listDocumentsForInvoiceSteps(
    tx,
    steps.map((s) => s.id),
  );
  const docsByStep = new Map<string, InvoiceDocumentRef[]>();
  for (const d of docs) {
    const list = docsByStep.get(d.invoiceStepId) ?? [];
    list.push({
      id: d.id,
      invoiceStepId: d.invoiceStepId,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes.toString(),
      sha256: d.sha256,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt,
    });
    docsByStep.set(d.invoiceStepId, list);
  }

  const openedAt = await resolveCurrentStepOpenedAt(tx, invoice, steps);
  const derived = deriveInvoiceStatus({
    status: invoice.status,
    dueDate: invoice.dueDate,
    currentStepOpenedAt: openedAt,
    waitingDays: DEFAULT_WAITING_DAYS,
  });

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    flowVersionId: invoice.flowVersionId,
    flowTemplateId: version.templateId,
    currentStepId: invoice.currentStepId,
    status: derived,
    storedStatus: invoice.status,
    partyName: invoice.partyName,
    amountMinor: invoice.amountMinor.toString(),
    amountRupees: paiseToRupees(invoice.amountMinor),
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    ownerId: invoice.ownerId,
    extra: asExtra(invoice.extra),
    createdBy: invoice.createdBy,
    createdAt: invoice.createdAt,
    deletedAt: invoice.deletedAt,
    steps: steps.map((s) => ({
      id: s.id,
      flowStepId: s.flowStepId,
      position: s.position,
      stepNumber: s.position + 1,
      name: s.stepName,
      allowedRole: s.allowedRole,
      fields: parseFlowFields(s.fields),
      status: s.status,
      completedBy: s.completedBy,
      completedAt: s.completedAt,
      data: asStepData(s.data),
      documents: docsByStep.get(s.id) ?? [],
    })),
  };
}

/**
 * Create an invoice pinned to the flow's latest published version (B5-03).
 */
export async function create(ctx: AuthContext, input: CreateInvoiceInput): Promise<InvoiceDetail> {
  const authed = assertCanMutateInvoices(ctx);
  await assertCanStartNewInvoices(authed, input.flowId);

  const amountMinor = rupeesToPaise(input.amountRupees);

  return withUser(authed, async (tx) => {
    const existing = await repo.getInvoiceByNo(tx, input.invoiceNo);
    if (existing) {
      throw new Conflict(`Invoice number "${input.invoiceNo}" already exists`);
    }

    const published = await flowRepo.getLatestPublishedVersion(tx, input.flowId);
    if (!published) {
      throw new Conflict("Flow has no published version");
    }

    const flowSteps = await flowRepo.listStepsForVersion(tx, published.id);
    if (flowSteps.length === 0) {
      throw new Validation("Published flow has no steps");
    }

    // Validate fields shape early so bad seeds surface as Validation.
    for (const step of flowSteps) {
      parseFlowFields(step.fields);
    }

    const firstStep = flowSteps[0]!;
    const invoice = await repo.insertInvoice(tx, {
      invoiceNo: input.invoiceNo,
      flowVersionId: published.id,
      currentStepId: firstStep.id,
      status: "open",
      partyName: input.partyName,
      amountMinor,
      issueDate: input.issueDate,
      dueDate: input.dueDate ?? null,
      ownerId: input.ownerId,
      extra: input.extra ?? {},
      createdBy: authed.userId,
    });

    await repo.insertInvoiceSteps(
      tx,
      flowSteps.map((s) => ({
        invoiceId: invoice.id,
        flowStepId: s.id,
        status: "open",
      })),
    );

    await audit({
      tx,
      ctx: authed,
      action: "invoice.create",
      entity: "invoice",
      entityId: invoice.id,
      after: {
        invoiceNo: invoice.invoiceNo,
        flowVersionId: invoice.flowVersionId,
        amountMinor: invoice.amountMinor.toString(),
        ownerId: invoice.ownerId,
      },
    });

    const fresh = await repo.getInvoiceById(tx, invoice.id);
    return buildDetail(tx, fresh!);
  });
}

/**
 * Update non-flow fields only (B5-04). Flow version is immutable.
 */
export async function update(
  ctx: AuthContext,
  invoiceId: string,
  input: UpdateInvoiceInput,
): Promise<InvoiceDetail> {
  const authed = assertCanMutateInvoices(ctx);

  // Refuse any attempt to sneak a flow change through a loosely typed body.
  const raw = input as Record<string, unknown>;
  if ("flowId" in raw || "flowVersionId" in raw || "flow_version_id" in raw) {
    throw new Validation("Flow version is immutable after invoice creation");
  }

  return withUser(authed, async (tx) => {
    const invoice = await repo.getInvoiceById(tx, invoiceId);
    if (!invoice || !canSeeInvoice(authed, invoice)) {
      throw new NotFound();
    }
    if (invoice.deletedAt) {
      throw new Conflict("Cannot update a deleted invoice");
    }
    if (invoice.status === "cancelled" || invoice.status === "completed") {
      throw new Conflict(`Cannot update a ${invoice.status} invoice`);
    }

    if (input.invoiceNo && input.invoiceNo !== invoice.invoiceNo) {
      const clash = await repo.getInvoiceByNo(tx, input.invoiceNo);
      if (clash) {
        throw new Conflict(`Invoice number "${input.invoiceNo}" already exists`);
      }
    }

    const issueDate = input.issueDate ?? invoice.issueDate;
    const dueDate = input.dueDate === undefined ? invoice.dueDate : input.dueDate;
    if (dueDate && dueDate < issueDate) {
      throw new Validation("dueDate must be on or after issueDate");
    }

    const patch: Parameters<typeof repo.updateInvoiceRow>[2] = {};
    if (input.invoiceNo !== undefined) patch.invoiceNo = input.invoiceNo;
    if (input.partyName !== undefined) patch.partyName = input.partyName;
    if (input.amountRupees !== undefined) {
      patch.amountMinor = rupeesToPaise(input.amountRupees);
    }
    if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
    if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
    if (input.extra !== undefined) patch.extra = input.extra;
    if (input.status === "cancelled") patch.status = "cancelled";

    const before = {
      invoiceNo: invoice.invoiceNo,
      partyName: invoice.partyName,
      amountMinor: invoice.amountMinor.toString(),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      ownerId: invoice.ownerId,
      status: invoice.status,
    };

    const updated = await repo.updateInvoiceRow(tx, invoiceId, patch);
    if (!updated) throw new NotFound();

    await audit({
      tx,
      ctx: authed,
      action: "invoice.update",
      entity: "invoice",
      entityId: invoiceId,
      before,
      after: {
        invoiceNo: updated.invoiceNo,
        partyName: updated.partyName,
        amountMinor: updated.amountMinor.toString(),
        issueDate: updated.issueDate,
        dueDate: updated.dueDate,
        ownerId: updated.ownerId,
        status: updated.status,
        flowVersionId: updated.flowVersionId,
      },
    });

    return buildDetail(tx, updated);
  });
}

/**
 * Invoice detail with steps, who/when, document refs (B5-07).
 * Soft-deleted → NotFound for non-Admin.
 */
export async function get(ctx: AuthContext, invoiceId: string): Promise<InvoiceDetail> {
  const authed = assertCanReadInvoices(ctx);

  return withUser(authed, async (tx) => {
    const invoice = await repo.getInvoiceById(tx, invoiceId);
    if (!invoice || !canSeeInvoice(authed, invoice)) {
      throw new NotFound();
    }
    return buildDetail(tx, invoice);
  });
}

/** Internal: load invoice row inside an existing tx (used by steps/documents). */
export async function getInvoiceRowOrThrow(
  tx: AppTx,
  ctx: RequestContext,
  invoiceId: string,
): Promise<repo.InvoiceRow> {
  const invoice = await repo.getInvoiceById(tx, invoiceId);
  if (!invoice || !canSeeInvoice(ctx, invoice)) {
    throw new NotFound();
  }
  return invoice;
}

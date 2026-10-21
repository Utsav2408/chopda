/**
 * Flow engine service (B4-03 … B4-08). Role checks, draft/publish rules,
 * audit, and transactions live here — repos only talk to SQL.
 */
import { audit } from "../audit/write.js";
import { requireRole, type AuthContext } from "../authz/index.js";
import type { AppTx } from "../db/client.js";
import { withUser, type RequestContext, type UserRole } from "../db/with-user.js";
import { Conflict, NotFound, Validation } from "../kernel/errors.js";
import * as repo from "./repo.js";
import type { FlowStepRow, FlowTemplateRow, FlowVersionRow } from "./repo.js";
import {
  createDraftInputSchema,
  flowFieldsSchema,
  flowStepInputSchema,
  parseFlowFields,
  type CreateDraftInput,
  type FlowField,
  type FlowFields,
  type FlowStepInput,
  type FlowStatus,
} from "./schema.js";

const MUTATE_ROLES: UserRole[] = ["admin", "builder"];
const READ_ROLES: UserRole[] = ["admin", "builder", "viewer"];

/** Auth gate for create/edit/publish/archive (also used by role matrix). */
export function assertCanMutateFlows(ctx: AuthContext): RequestContext {
  return requireRole(ctx, ...MUTATE_ROLES);
}

/** Auth gate for list/get/diff (also used by role matrix). */
export function assertCanReadFlows(ctx: AuthContext): RequestContext {
  return requireRole(ctx, ...READ_ROLES);
}

export type FlowStepView = {
  id: string;
  position: number;
  /** 1-based position for UI chips / diff highlight. */
  stepNumber: number;
  name: string;
  instructions: string | null;
  allowedRole: UserRole;
  fields: FlowFields;
};

export type FlowDetail = {
  id: string;
  name: string;
  status: FlowStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** Latest published version number, or null if never published. */
  publishedVersionNo: number | null;
  /** Version currently being edited (draft), if any. */
  draftVersionId: string | null;
  /** Version whose steps are returned (draft if present, else latest published). */
  workingVersionId: string | null;
  steps: FlowStepView[];
  activeInvoiceCount: number;
};

export type FlowListItem = {
  id: string;
  name: string;
  status: FlowStatus;
  publishedVersionNo: number | null;
  /** Step chips from the working version (draft preferred). */
  steps: { stepNumber: number; name: string }[];
  activeInvoiceCount: number;
};

/** Lightweight flow row for invoice filter / new-invoice dropdowns (no steps). */
export type FlowSummary = {
  id: string;
  name: string;
  status: FlowStatus;
  publishedVersionNo: number | null;
};

export type FlowDiff = {
  flowId: string;
  otherFlowId: string;
  /** 1-based step positions that differ (powers the library highlight). */
  differingStepNumbers: number[];
};

function asStatus(raw: string): FlowStatus {
  if (raw === "draft" || raw === "published" || raw === "archived") return raw;
  throw new Validation(`Unknown flow status: ${raw}`);
}

function toStepView(row: FlowStepRow): FlowStepView {
  return {
    id: row.id,
    position: row.position,
    stepNumber: row.position + 1,
    name: row.name,
    instructions: row.instructions,
    allowedRole: row.allowedRole,
    fields: parseFlowFields(row.fields),
  };
}

function stepsEqual(a: FlowStepView, b: FlowStepView): boolean {
  return (
    a.name === b.name &&
    a.instructions === b.instructions &&
    a.allowedRole === b.allowedRole &&
    JSON.stringify(a.fields) === JSON.stringify(b.fields)
  );
}

async function loadWorkingVersion(
  tx: AppTx,
  templateId: string,
): Promise<FlowVersionRow | undefined> {
  const draft = await repo.getDraftVersion(tx, templateId);
  if (draft) return draft;
  return repo.getLatestPublishedVersion(tx, templateId);
}

async function buildDetail(tx: AppTx, template: FlowTemplateRow): Promise<FlowDetail> {
  const draft = await repo.getDraftVersion(tx, template.id);
  const published = await repo.getLatestPublishedVersion(tx, template.id);
  const working = draft ?? published;
  const steps = working ? (await repo.listStepsForVersion(tx, working.id)).map(toStepView) : [];
  const activeInvoiceCount = await repo.countActiveInvoicesForTemplate(tx, template.id);
  return {
    id: template.id,
    name: template.name,
    status: asStatus(template.status),
    createdBy: template.createdBy,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    publishedVersionNo: published?.versionNo ?? null,
    draftVersionId: draft?.id ?? null,
    workingVersionId: working?.id ?? null,
    steps,
    activeInvoiceCount,
  };
}

/**
 * Ensure there is an editable draft version. If the flow only has published
 * versions, fork a new draft (copy steps) and set template status to draft.
 */
async function ensureEditableDraft(
  tx: AppTx,
  ctx: RequestContext,
  template: FlowTemplateRow,
): Promise<{ template: FlowTemplateRow; version: FlowVersionRow }> {
  if (asStatus(template.status) === "archived") {
    throw new Conflict("Archived flows cannot be edited");
  }

  const existingDraft = await repo.getDraftVersion(tx, template.id);
  if (existingDraft) {
    return { template, version: existingDraft };
  }

  const latestPublished = await repo.getLatestPublishedVersion(tx, template.id);
  if (!latestPublished) {
    // Never published — create the first draft version.
    const version = await repo.insertVersion(tx, {
      templateId: template.id,
      versionNo: 1,
      publishedAt: null,
    });
    const updated =
      asStatus(template.status) === "draft"
        ? template
        : ((await repo.updateTemplateStatus(tx, template.id, "draft")) ?? template);
    return { template: updated, version };
  }

  // Fork published → new draft version N+1 with copied steps.
  const nextNo = (await repo.maxVersionNo(tx, template.id)) + 1;
  const version = await repo.insertVersion(tx, {
    templateId: template.id,
    versionNo: nextNo,
    publishedAt: null,
  });
  const sourceSteps = await repo.listStepsForVersion(tx, latestPublished.id);
  await repo.insertSteps(
    tx,
    version.id,
    sourceSteps.map((s) => ({
      position: s.position,
      name: s.name,
      instructions: s.instructions,
      allowedRole: s.allowedRole,
      fields: parseFlowFields(s.fields),
    })),
  );
  const updated = (await repo.updateTemplateStatus(tx, template.id, "draft")) ?? template;
  await audit({
    tx,
    ctx,
    action: "flow.edit_start_draft",
    entity: "flow_template",
    entityId: template.id,
    before: { status: template.status, publishedVersionNo: latestPublished.versionNo },
    after: { status: "draft", draftVersionNo: nextNo },
  });
  return { template: updated, version };
}

function assertVersionEditable(version: FlowVersionRow): void {
  if (version.publishedAt !== null) {
    throw new Conflict("Cannot modify steps of a published flow version");
  }
}

/**
 * Resolve a step id onto the editable draft version. When ensureEditableDraft
 * just forked from published, map the caller's published step id by position.
 */
async function resolveDraftStep(
  tx: AppTx,
  draftVersion: FlowVersionRow,
  stepId: string,
  opts: { allowPublishedMap: boolean },
): Promise<FlowStepRow> {
  const step = await repo.getStepById(tx, stepId);
  if (!step) throw new NotFound();
  if (step.versionId === draftVersion.id) return step;
  if (!opts.allowPublishedMap) throw new NotFound();

  const draftSteps = await repo.listStepsForVersion(tx, draftVersion.id);
  const sibling = draftSteps.find((s) => s.position === step.position);
  if (!sibling) throw new NotFound();
  return sibling;
}

// ----- public API -----

export async function createDraft(ctx: AuthContext, input: CreateDraftInput): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);
  const parsed = createDraftInputSchema.parse(input);

  return withUser(authed, async (tx) => {
    const existing = await repo.getTemplateByName(tx, parsed.name);
    if (existing) {
      throw new Conflict(`A flow named "${parsed.name}" already exists`);
    }

    const template = await repo.insertTemplate(tx, {
      name: parsed.name,
      status: "draft",
      createdBy: authed.userId,
    });
    await repo.insertVersion(tx, {
      templateId: template.id,
      versionNo: 1,
      publishedAt: null,
    });

    await audit({
      tx,
      ctx: authed,
      action: "flow.create",
      entity: "flow_template",
      entityId: template.id,
      after: { name: template.name, status: template.status },
    });

    return buildDetail(tx, template);
  });
}

export async function duplicate(ctx: AuthContext, flowId: string): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const source = await repo.getTemplateById(tx, flowId);
    if (!source) throw new NotFound();

    const working = await loadWorkingVersion(tx, source.id);
    const sourceSteps = working ? await repo.listStepsForVersion(tx, working.id) : [];

    let name = `${source.name} (copy)`;
    let suffix = 2;
    while (await repo.getTemplateByName(tx, name)) {
      name = `${source.name} (copy ${suffix})`;
      suffix += 1;
    }

    const template = await repo.insertTemplate(tx, {
      name,
      status: "draft",
      createdBy: authed.userId,
    });
    const version = await repo.insertVersion(tx, {
      templateId: template.id,
      versionNo: 1,
      publishedAt: null,
    });
    await repo.insertSteps(
      tx,
      version.id,
      sourceSteps.map((s) => ({
        position: s.position,
        name: s.name,
        instructions: s.instructions,
        allowedRole: s.allowedRole,
        fields: parseFlowFields(s.fields),
      })),
    );

    await audit({
      tx,
      ctx: authed,
      action: "flow.duplicate",
      entity: "flow_template",
      entityId: template.id,
      before: { sourceId: source.id },
      after: { name: template.name, status: "draft" },
    });

    return buildDetail(tx, template);
  });
}

export async function addStep(
  ctx: AuthContext,
  flowId: string,
  input: FlowStepInput,
): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);
  const step = flowStepInputSchema.parse(input);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();

    const { template: editable, version } = await ensureEditableDraft(tx, authed, template);
    assertVersionEditable(version);

    const existing = await repo.listStepsForVersion(tx, version.id);
    const position = existing.length;
    const fields = flowFieldsSchema.parse(step.fields ?? []);

    await repo.insertStep(tx, version.id, {
      position,
      name: step.name,
      instructions: step.instructions ?? null,
      allowedRole: step.allowedRole,
      fields,
    });

    await audit({
      tx,
      ctx: authed,
      action: "flow.edit",
      entity: "flow_template",
      entityId: editable.id,
      after: { op: "addStep", name: step.name, position },
    });

    return buildDetail(tx, editable);
  });
}

export async function editStep(
  ctx: AuthContext,
  flowId: string,
  stepId: string,
  patch: Partial<FlowStepInput>,
): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();

    const hadDraft = (await repo.getDraftVersion(tx, template.id)) !== undefined;
    const { template: editable, version } = await ensureEditableDraft(tx, authed, template);
    assertVersionEditable(version);

    const step = await resolveDraftStep(tx, version, stepId, {
      allowPublishedMap: !hadDraft,
    });

    const next: {
      name?: string;
      instructions?: string | null;
      allowedRole?: UserRole;
      fields?: FlowField[];
    } = {};
    if (patch.name !== undefined) next.name = flowStepInputSchema.shape.name.parse(patch.name);
    if (patch.instructions !== undefined) {
      next.instructions =
        patch.instructions === null
          ? null
          : (flowStepInputSchema.shape.instructions.parse(patch.instructions) ?? null);
    }
    if (patch.allowedRole !== undefined) {
      next.allowedRole = flowStepInputSchema.shape.allowedRole.parse(patch.allowedRole);
    }
    if (patch.fields !== undefined) {
      next.fields = flowFieldsSchema.parse(patch.fields);
    }

    const before = {
      name: step.name,
      instructions: step.instructions,
      allowedRole: step.allowedRole,
      fields: step.fields,
    };
    await repo.updateStep(tx, step.id, next);

    await audit({
      tx,
      ctx: authed,
      action: "flow.edit",
      entity: "flow_step",
      entityId: step.id,
      before,
      after: { ...before, ...next, op: "editStep", flowId: editable.id },
    });

    return buildDetail(tx, editable);
  });
}

export async function removeStep(
  ctx: AuthContext,
  flowId: string,
  stepId: string,
): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();

    const hadDraft = (await repo.getDraftVersion(tx, template.id)) !== undefined;
    const { template: editable, version } = await ensureEditableDraft(tx, authed, template);
    assertVersionEditable(version);

    const step = await resolveDraftStep(tx, version, stepId, {
      allowPublishedMap: !hadDraft,
    });

    await repo.deleteStep(tx, step.id);

    const remaining = await repo.listStepsForVersion(tx, version.id);
    // Compact positions (two-phase to avoid unique collisions).
    await repo.setStepPositions(
      tx,
      remaining.map((s, i) => ({ id: s.id, position: -(i + 1) })),
    );
    await repo.setStepPositions(
      tx,
      remaining.map((s, i) => ({ id: s.id, position: i })),
    );

    await audit({
      tx,
      ctx: authed,
      action: "flow.edit",
      entity: "flow_template",
      entityId: editable.id,
      after: { op: "removeStep", stepId: step.id, name: step.name },
    });

    return buildDetail(tx, editable);
  });
}

export async function reorderSteps(
  ctx: AuthContext,
  flowId: string,
  orderedStepIds: string[],
): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();

    const hadDraft = (await repo.getDraftVersion(tx, template.id)) !== undefined;
    const { template: editable, version } = await ensureEditableDraft(tx, authed, template);
    assertVersionEditable(version);

    const resolvedIds: string[] = [];
    for (const id of orderedStepIds) {
      const step = await resolveDraftStep(tx, version, id, {
        allowPublishedMap: !hadDraft,
      });
      resolvedIds.push(step.id);
    }

    const existing = await repo.listStepsForVersion(tx, version.id);
    if (resolvedIds.length !== existing.length) {
      throw new Validation("reorderSteps must include every step id exactly once");
    }
    const existingIds = new Set(existing.map((s) => s.id));
    for (const id of resolvedIds) {
      if (!existingIds.has(id)) {
        throw new Validation(`Unknown step id in reorder: ${id}`);
      }
    }
    if (new Set(resolvedIds).size !== resolvedIds.length) {
      throw new Validation("Duplicate step id in reorder");
    }

    await repo.setStepPositions(
      tx,
      resolvedIds.map((id, i) => ({ id, position: -(i + 1) })),
    );
    await repo.setStepPositions(
      tx,
      resolvedIds.map((id, i) => ({ id, position: i })),
    );

    await audit({
      tx,
      ctx: authed,
      action: "flow.edit",
      entity: "flow_template",
      entityId: editable.id,
      after: { op: "reorderSteps", orderedStepIds: resolvedIds },
    });

    return buildDetail(tx, editable);
  });
}

/**
 * Freeze the current draft as published version N+1 (or v1 on first publish).
 * Later edits fork a new draft so published steps stay byte-identical.
 */
export async function publish(ctx: AuthContext, flowId: string): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();
    if (asStatus(template.status) === "archived") {
      throw new Conflict("Archived flows cannot be published");
    }

    const draft = await repo.getDraftVersion(tx, template.id);
    if (!draft) {
      throw new Conflict("No draft version to publish");
    }

    const steps = await repo.listStepsForVersion(tx, draft.id);
    if (steps.length === 0) {
      throw new Validation("Cannot publish a flow with no steps");
    }

    const publishedBefore = await repo.getLatestPublishedVersion(tx, template.id);
    // Draft already carries the next version_no when forked; on first create it's 1.
    const frozen = await repo.publishVersion(tx, draft.id, new Date());
    if (!frozen) throw new Conflict("Failed to publish version");

    const updated = (await repo.updateTemplateStatus(tx, template.id, "published")) ?? template;

    await audit({
      tx,
      ctx: authed,
      action: "flow.publish",
      entity: "flow_template",
      entityId: template.id,
      before: {
        status: template.status,
        previousPublishedVersionNo: publishedBefore?.versionNo ?? null,
      },
      after: { status: "published", versionNo: frozen.versionNo, versionId: frozen.id },
    });

    return buildDetail(tx, updated);
  });
}

export async function archive(ctx: AuthContext, flowId: string): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();
    if (asStatus(template.status) === "archived") {
      return buildDetail(tx, template);
    }

    const updated = (await repo.updateTemplateStatus(tx, template.id, "archived")) ?? template;

    await audit({
      tx,
      ctx: authed,
      action: "flow.archive",
      entity: "flow_template",
      entityId: template.id,
      before: { status: template.status },
      after: { status: "archived" },
    });

    return buildDetail(tx, updated);
  });
}

/**
 * Restore an archived flow. Becomes published if a published version exists,
 * otherwise draft (Admin/Builder).
 */
export async function unarchive(ctx: AuthContext, flowId: string): Promise<FlowDetail> {
  const authed = assertCanMutateFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();
    if (asStatus(template.status) !== "archived") {
      return buildDetail(tx, template);
    }

    const published = await repo.getLatestPublishedVersion(tx, template.id);
    const nextStatus: FlowStatus = published ? "published" : "draft";
    const updated = (await repo.updateTemplateStatus(tx, template.id, nextStatus)) ?? template;

    await audit({
      tx,
      ctx: authed,
      action: "flow.unarchive",
      entity: "flow_template",
      entityId: template.id,
      before: { status: "archived" },
      after: { status: nextStatus },
    });

    return buildDetail(tx, updated);
  });
}

/**
 * Whether new invoices may be started on this flow (B4-06 / B5).
 * Archived → false; never-published draft → false; published → true.
 */
export async function canStartNewInvoices(ctx: AuthContext, flowId: string): Promise<boolean> {
  const authed = assertCanReadFlows(ctx);
  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();
    if (asStatus(template.status) === "archived") return false;
    const published = await repo.getLatestPublishedVersion(tx, template.id);
    return published !== undefined;
  });
}

export async function assertCanStartNewInvoices(ctx: AuthContext, flowId: string): Promise<void> {
  const ok = await canStartNewInvoices(ctx, flowId);
  if (!ok) {
    // Distinguish archived vs missing published for clearer Validation messages.
    const authed = assertCanReadFlows(ctx);
    await withUser(authed, async (tx) => {
      const template = await repo.getTemplateById(tx, flowId);
      if (!template) throw new NotFound();
      if (asStatus(template.status) === "archived") {
        throw new Conflict("Archived flows cannot start new invoices");
      }
      throw new Conflict("Flow has no published version");
    });
  }
}

export async function list(ctx: AuthContext): Promise<FlowListItem[]> {
  const authed = assertCanReadFlows(ctx);

  return withUser(authed, async (tx) => {
    const templates = await repo.listTemplates(tx);
    if (templates.length === 0) return [];

    const templateIds = templates.map((t) => t.id);
    const [allVersions, activeCounts] = await Promise.all([
      repo.listVersionsForTemplates(tx, templateIds),
      repo.countActiveInvoicesByTemplate(tx, templateIds),
    ]);

    const draftsByTemplate = new Map<string, FlowVersionRow>();
    const publishedByTemplate = new Map<string, FlowVersionRow>();
    for (const v of allVersions) {
      if (v.publishedAt == null) {
        const cur = draftsByTemplate.get(v.templateId);
        if (!cur || v.versionNo > cur.versionNo) draftsByTemplate.set(v.templateId, v);
      } else {
        const cur = publishedByTemplate.get(v.templateId);
        if (!cur || v.versionNo > cur.versionNo) publishedByTemplate.set(v.templateId, v);
      }
    }

    const workingIds: string[] = [];
    const workingByTemplate = new Map<string, FlowVersionRow>();
    for (const t of templates) {
      const working = draftsByTemplate.get(t.id) ?? publishedByTemplate.get(t.id);
      if (working) {
        workingByTemplate.set(t.id, working);
        workingIds.push(working.id);
      }
    }

    const allSteps = await repo.listStepsForVersions(tx, workingIds);
    const stepsByVersion = new Map<string, FlowStepRow[]>();
    for (const s of allSteps) {
      const list = stepsByVersion.get(s.versionId) ?? [];
      list.push(s);
      stepsByVersion.set(s.versionId, list);
    }

    return templates.map((template) => {
      const published = publishedByTemplate.get(template.id);
      const working = workingByTemplate.get(template.id);
      const steps = working
        ? (stepsByVersion.get(working.id) ?? []).map((s) => ({
            stepNumber: s.position + 1,
            name: s.name,
          }))
        : [];
      return {
        id: template.id,
        name: template.name,
        status: asStatus(template.status),
        publishedVersionNo: published?.versionNo ?? null,
        steps,
        activeInvoiceCount: activeCounts.get(template.id) ?? 0,
      };
    });
  });
}

/** Summaries only — for invoice filters / create form (no steps or counts). */
export async function listSummaries(ctx: AuthContext): Promise<FlowSummary[]> {
  const authed = assertCanReadFlows(ctx);

  return withUser(authed, async (tx) => {
    const templates = await repo.listTemplates(tx);
    if (templates.length === 0) return [];

    const versions = await repo.listVersionsForTemplates(
      tx,
      templates.map((t) => t.id),
    );
    const publishedByTemplate = new Map<string, FlowVersionRow>();
    for (const v of versions) {
      if (v.publishedAt == null) continue;
      const cur = publishedByTemplate.get(v.templateId);
      if (!cur || v.versionNo > cur.versionNo) publishedByTemplate.set(v.templateId, v);
    }

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      status: asStatus(template.status),
      publishedVersionNo: publishedByTemplate.get(template.id)?.versionNo ?? null,
    }));
  });
}

export async function get(ctx: AuthContext, flowId: string): Promise<FlowDetail> {
  const authed = assertCanReadFlows(ctx);

  return withUser(authed, async (tx) => {
    const template = await repo.getTemplateById(tx, flowId);
    if (!template) throw new NotFound();
    return buildDetail(tx, template);
  });
}

/**
 * Compare working versions of two flows; return 1-based step numbers that differ.
 */
export async function diffAgainst(
  ctx: AuthContext,
  flowId: string,
  otherFlowId: string,
): Promise<FlowDiff> {
  const authed = assertCanReadFlows(ctx);

  return withUser(authed, async (tx) => {
    const a = await repo.getTemplateById(tx, flowId);
    const b = await repo.getTemplateById(tx, otherFlowId);
    if (!a || !b) throw new NotFound();

    const va = await loadWorkingVersion(tx, a.id);
    const vb = await loadWorkingVersion(tx, b.id);
    const stepsA = va ? (await repo.listStepsForVersion(tx, va.id)).map(toStepView) : [];
    const stepsB = vb ? (await repo.listStepsForVersion(tx, vb.id)).map(toStepView) : [];

    const maxLen = Math.max(stepsA.length, stepsB.length);
    const differingStepNumbers: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      const sa = stepsA[i];
      const sb = stepsB[i];
      if (!sa || !sb || !stepsEqual(sa, sb)) {
        differingStepNumbers.push(i + 1);
      }
    }

    return { flowId, otherFlowId, differingStepNumbers };
  });
}

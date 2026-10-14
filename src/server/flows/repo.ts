/**
 * Flow persistence helpers (B4). Called only from the flows service, always
 * with the same AppTx that carries RLS GUCs.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { AppTx } from "../db/client.js";
import { flowSteps, flowTemplates, flowVersions, invoices } from "../db/schema.js";
import type { FlowField, FlowStatus, FlowUserRole } from "./schema.js";

export type FlowTemplateRow = typeof flowTemplates.$inferSelect;
export type FlowVersionRow = typeof flowVersions.$inferSelect;
export type FlowStepRow = typeof flowSteps.$inferSelect;

export type StepInsert = {
  position: number;
  name: string;
  instructions: string | null;
  allowedRole: FlowUserRole;
  fields: FlowField[];
};

export async function insertTemplate(
  tx: AppTx,
  input: { name: string; status: FlowStatus; createdBy: string },
): Promise<FlowTemplateRow> {
  const [row] = await tx
    .insert(flowTemplates)
    .values({
      name: input.name,
      status: input.status,
      createdBy: input.createdBy,
    })
    .returning();
  return row!;
}

export async function updateTemplateStatus(
  tx: AppTx,
  templateId: string,
  status: FlowStatus,
): Promise<FlowTemplateRow | undefined> {
  const [row] = await tx
    .update(flowTemplates)
    .set({ status, updatedAt: new Date() })
    .where(eq(flowTemplates.id, templateId))
    .returning();
  return row;
}

export async function getTemplateById(
  tx: AppTx,
  templateId: string,
): Promise<FlowTemplateRow | undefined> {
  const [row] = await tx
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1);
  return row;
}

export async function getTemplateByName(
  tx: AppTx,
  name: string,
): Promise<FlowTemplateRow | undefined> {
  const [row] = await tx.select().from(flowTemplates).where(eq(flowTemplates.name, name)).limit(1);
  return row;
}

export async function listTemplates(tx: AppTx): Promise<FlowTemplateRow[]> {
  return tx.select().from(flowTemplates).orderBy(asc(flowTemplates.name));
}

export async function insertVersion(
  tx: AppTx,
  input: { templateId: string; versionNo: number; publishedAt?: Date | null },
): Promise<FlowVersionRow> {
  const [row] = await tx
    .insert(flowVersions)
    .values({
      templateId: input.templateId,
      versionNo: input.versionNo,
      publishedAt: input.publishedAt ?? null,
    })
    .returning();
  return row!;
}

export async function publishVersion(
  tx: AppTx,
  versionId: string,
  publishedAt: Date = new Date(),
): Promise<FlowVersionRow | undefined> {
  const [row] = await tx
    .update(flowVersions)
    .set({ publishedAt })
    .where(eq(flowVersions.id, versionId))
    .returning();
  return row;
}

export async function getVersionById(
  tx: AppTx,
  versionId: string,
): Promise<FlowVersionRow | undefined> {
  const [row] = await tx.select().from(flowVersions).where(eq(flowVersions.id, versionId)).limit(1);
  return row;
}

export async function listVersionsForTemplate(
  tx: AppTx,
  templateId: string,
): Promise<FlowVersionRow[]> {
  return tx
    .select()
    .from(flowVersions)
    .where(eq(flowVersions.templateId, templateId))
    .orderBy(asc(flowVersions.versionNo));
}

/** Latest draft (unpublished) version for a template, if any. */
export async function getDraftVersion(
  tx: AppTx,
  templateId: string,
): Promise<FlowVersionRow | undefined> {
  const [row] = await tx
    .select()
    .from(flowVersions)
    .where(and(eq(flowVersions.templateId, templateId), isNull(flowVersions.publishedAt)))
    .orderBy(desc(flowVersions.versionNo))
    .limit(1);
  return row;
}

/** Latest published version for a template, if any. */
export async function getLatestPublishedVersion(
  tx: AppTx,
  templateId: string,
): Promise<FlowVersionRow | undefined> {
  const [row] = await tx
    .select()
    .from(flowVersions)
    .where(and(eq(flowVersions.templateId, templateId), isNotNull(flowVersions.publishedAt)))
    .orderBy(desc(flowVersions.versionNo))
    .limit(1);
  return row;
}

export async function maxVersionNo(tx: AppTx, templateId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${flowVersions.versionNo}), 0)` })
    .from(flowVersions)
    .where(eq(flowVersions.templateId, templateId));
  return Number(row?.max ?? 0);
}

export async function insertStep(
  tx: AppTx,
  versionId: string,
  step: StepInsert,
): Promise<FlowStepRow> {
  const [row] = await tx
    .insert(flowSteps)
    .values({
      versionId,
      position: step.position,
      name: step.name,
      instructions: step.instructions,
      allowedRole: step.allowedRole,
      fields: step.fields,
    })
    .returning();
  return row!;
}

export async function insertSteps(
  tx: AppTx,
  versionId: string,
  steps: StepInsert[],
): Promise<FlowStepRow[]> {
  if (steps.length === 0) return [];
  return tx
    .insert(flowSteps)
    .values(
      steps.map((step) => ({
        versionId,
        position: step.position,
        name: step.name,
        instructions: step.instructions,
        allowedRole: step.allowedRole,
        fields: step.fields,
      })),
    )
    .returning();
}

export async function listStepsForVersion(tx: AppTx, versionId: string): Promise<FlowStepRow[]> {
  return tx
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.versionId, versionId))
    .orderBy(asc(flowSteps.position));
}

export async function getStepById(tx: AppTx, stepId: string): Promise<FlowStepRow | undefined> {
  const [row] = await tx.select().from(flowSteps).where(eq(flowSteps.id, stepId)).limit(1);
  return row;
}

export async function updateStep(
  tx: AppTx,
  stepId: string,
  patch: Partial<{
    name: string;
    instructions: string | null;
    allowedRole: FlowUserRole;
    fields: FlowField[];
    position: number;
  }>,
): Promise<FlowStepRow | undefined> {
  const [row] = await tx.update(flowSteps).set(patch).where(eq(flowSteps.id, stepId)).returning();
  return row;
}

export async function deleteStep(tx: AppTx, stepId: string): Promise<void> {
  await tx.delete(flowSteps).where(eq(flowSteps.id, stepId));
}

export async function setStepPositions(
  tx: AppTx,
  updates: { id: string; position: number }[],
): Promise<void> {
  for (const u of updates) {
    await tx.update(flowSteps).set({ position: u.position }).where(eq(flowSteps.id, u.id));
  }
}

/** Active (non-deleted, not completed/cancelled) invoices pinned to any version of the template. */
export async function countActiveInvoicesForTemplate(
  tx: AppTx,
  templateId: string,
): Promise<number> {
  const versions = await tx
    .select({ id: flowVersions.id })
    .from(flowVersions)
    .where(eq(flowVersions.templateId, templateId));
  if (versions.length === 0) return 0;
  const versionIds = versions.map((v) => v.id);

  const [row] = await tx
    .select({ n: count() })
    .from(invoices)
    .where(
      and(
        inArray(invoices.flowVersionId, versionIds),
        isNull(invoices.deletedAt),
        ne(invoices.status, "completed"),
        ne(invoices.status, "cancelled"),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Thin server actions for flows (B4-10).
 * Session is resolved from cookies server-side — never trust a client-supplied ctx.
 */
"use server";

import { cookies } from "next/headers";
import {
  addStep,
  archive,
  createDraft,
  createDraftInputSchema,
  diffAgainst,
  duplicate,
  editStep,
  flowStepInputSchema,
  get,
  list,
  publish,
  removeStep,
  reorderSteps,
  type FlowDetail,
  type FlowDiff,
  type FlowListItem,
} from "../flows/index.js";
import { resolveSession } from "../auth/index.js";
import { SESSION_COOKIE_NAME } from "../security/constants.js";
import { Unauthenticated, Validation } from "../kernel/errors.js";

async function ctxFromCookies() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const resolved = await resolveSession(token);
  if (!resolved) {
    throw new Unauthenticated();
  }
  return resolved.ctx;
}

export async function flowsCreateDraftAction(raw: unknown): Promise<FlowDetail> {
  const parsed = createDraftInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid create draft payload");
  const ctx = await ctxFromCookies();
  return createDraft(ctx, parsed.data);
}

export async function flowsListAction(): Promise<FlowListItem[]> {
  const ctx = await ctxFromCookies();
  return list(ctx);
}

export async function flowsGetAction(flowId: string): Promise<FlowDetail> {
  const ctx = await ctxFromCookies();
  return get(ctx, flowId);
}

export async function flowsDuplicateAction(flowId: string): Promise<FlowDetail> {
  const ctx = await ctxFromCookies();
  return duplicate(ctx, flowId);
}

export async function flowsAddStepAction(flowId: string, raw: unknown): Promise<FlowDetail> {
  const parsed = flowStepInputSchema.safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid add step payload");
  const ctx = await ctxFromCookies();
  return addStep(ctx, flowId, parsed.data);
}

export async function flowsEditStepAction(
  flowId: string,
  stepId: string,
  raw: unknown,
): Promise<FlowDetail> {
  const parsed = flowStepInputSchema.partial().safeParse(raw);
  if (!parsed.success) throw new Validation("Invalid edit step payload");
  const ctx = await ctxFromCookies();
  return editStep(ctx, flowId, stepId, parsed.data);
}

export async function flowsRemoveStepAction(flowId: string, stepId: string): Promise<FlowDetail> {
  const ctx = await ctxFromCookies();
  return removeStep(ctx, flowId, stepId);
}

export async function flowsReorderStepsAction(flowId: string, raw: unknown): Promise<FlowDetail> {
  const orderedStepIds = (raw as { orderedStepIds?: unknown })?.orderedStepIds;
  if (!Array.isArray(orderedStepIds) || !orderedStepIds.every((id) => typeof id === "string")) {
    throw new Validation("orderedStepIds must be a string array");
  }
  const ctx = await ctxFromCookies();
  return reorderSteps(ctx, flowId, orderedStepIds);
}

export async function flowsPublishAction(flowId: string): Promise<FlowDetail> {
  const ctx = await ctxFromCookies();
  return publish(ctx, flowId);
}

export async function flowsArchiveAction(flowId: string): Promise<FlowDetail> {
  const ctx = await ctxFromCookies();
  return archive(ctx, flowId);
}

export async function flowsDiffAgainstAction(
  flowId: string,
  otherFlowId: string,
): Promise<FlowDiff> {
  const ctx = await ctxFromCookies();
  return diffAgainst(ctx, flowId, otherFlowId);
}

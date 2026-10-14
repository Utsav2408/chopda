/**
 * UI-facing flow actions (U3). Lives outside `@/server` so app/components
 * can import without tripping the client DAL import ban.
 */
"use server";

import { cookies } from "next/headers";
import { resolveSession } from "../server/auth/index.js";
import {
  addStep,
  archive,
  createDraft,
  diffAgainst,
  duplicate,
  editStep,
  get,
  list,
  publish,
  removeStep,
  reorderSteps,
  type FlowDetail,
  type FlowDiff,
  type FlowListItem,
} from "../server/flows/index.js";
import { Unauthenticated } from "../server/kernel/errors.js";
import { SESSION_COOKIE_NAME } from "../server/security/constants.js";
import type { StepField } from "@/lib/flow-fields";

export type FlowStatusDTO = "draft" | "published" | "archived";
export type FlowRoleDTO = "admin" | "builder" | "viewer";

export type FlowListItemDTO = {
  id: string;
  name: string;
  status: FlowStatusDTO;
  publishedVersionNo: number | null;
  steps: { stepNumber: number; name: string }[];
  activeInvoiceCount: number;
};

export type FlowStepDTO = {
  id: string;
  position: number;
  stepNumber: number;
  name: string;
  instructions: string | null;
  allowedRole: FlowRoleDTO;
  fields: StepField[];
};

export type FlowDetailDTO = {
  id: string;
  name: string;
  status: FlowStatusDTO;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedVersionNo: number | null;
  draftVersionId: string | null;
  workingVersionId: string | null;
  steps: FlowStepDTO[];
  activeInvoiceCount: number;
};

export type FlowDiffDTO = {
  flowId: string;
  otherFlowId: string;
  differingStepNumbers: number[];
};

async function ctxFromCookies() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const resolved = await resolveSession(token);
  if (!resolved) {
    throw new Unauthenticated();
  }
  return resolved.ctx;
}

function toListItem(item: FlowListItem): FlowListItemDTO {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    publishedVersionNo: item.publishedVersionNo,
    steps: item.steps.map((s) => ({ stepNumber: s.stepNumber, name: s.name })),
    activeInvoiceCount: item.activeInvoiceCount,
  };
}

function toDetail(detail: FlowDetail): FlowDetailDTO {
  return {
    id: detail.id,
    name: detail.name,
    status: detail.status,
    createdBy: detail.createdBy,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
    publishedVersionNo: detail.publishedVersionNo,
    draftVersionId: detail.draftVersionId,
    workingVersionId: detail.workingVersionId,
    steps: detail.steps.map((s) => ({
      id: s.id,
      position: s.position,
      stepNumber: s.stepNumber,
      name: s.name,
      instructions: s.instructions,
      allowedRole: s.allowedRole,
      fields: s.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
      })),
    })),
    activeInvoiceCount: detail.activeInvoiceCount,
  };
}

function toDiff(diff: FlowDiff): FlowDiffDTO {
  return {
    flowId: diff.flowId,
    otherFlowId: diff.otherFlowId,
    differingStepNumbers: [...diff.differingStepNumbers],
  };
}

export async function listFlows(): Promise<FlowListItemDTO[]> {
  const ctx = await ctxFromCookies();
  const items = await list(ctx);
  return items.map(toListItem);
}

/** Alias for U4 / call sites that follow B4 action names. */
export async function flowsListAction(): Promise<FlowListItemDTO[]> {
  return listFlows();
}

export async function getFlow(flowId: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await get(ctx, flowId));
}

export async function createFlowDraft(name: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await createDraft(ctx, { name }));
}

export async function duplicateFlow(flowId: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await duplicate(ctx, flowId));
}

export async function addFlowStep(
  flowId: string,
  input: {
    name: string;
    instructions?: string | null;
    allowedRole: FlowRoleDTO;
    fields?: StepField[];
  },
): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(
    await addStep(ctx, flowId, {
      name: input.name,
      instructions: input.instructions,
      allowedRole: input.allowedRole,
      fields: input.fields ?? [],
    }),
  );
}

export async function editFlowStep(
  flowId: string,
  stepId: string,
  patch: {
    name?: string;
    instructions?: string | null;
    allowedRole?: FlowRoleDTO;
    fields?: StepField[];
  },
): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await editStep(ctx, flowId, stepId, patch));
}

export async function removeFlowStep(flowId: string, stepId: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await removeStep(ctx, flowId, stepId));
}

export async function reorderFlowSteps(
  flowId: string,
  orderedStepIds: string[],
): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await reorderSteps(ctx, flowId, orderedStepIds));
}

export async function publishFlow(flowId: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await publish(ctx, flowId));
}

export async function archiveFlow(flowId: string): Promise<FlowDetailDTO> {
  const ctx = await ctxFromCookies();
  return toDetail(await archive(ctx, flowId));
}

export async function diffFlows(flowId: string, otherFlowId: string): Promise<FlowDiffDTO> {
  const ctx = await ctxFromCookies();
  return toDiff(await diffAgainst(ctx, flowId, otherFlowId));
}

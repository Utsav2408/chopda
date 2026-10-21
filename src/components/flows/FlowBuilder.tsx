"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addFlowStep,
  editFlowStep,
  publishFlow,
  removeFlowStep,
  reorderFlowSteps,
  type FlowDetailDTO,
  type FlowRoleDTO,
  type FlowStepDTO,
} from "@/actions/flows";
import { actionErrorMessage } from "@/lib/action-errors";
import type { StepField } from "@/lib/flow-fields";
import { FormField } from "@/components/forms/FormField";
import { StepForm } from "@/components/steps/StepForm";
import { ConfirmDialog, StatusChip, type StatusTone } from "@/components/ui";
import { FieldsEditor } from "./FieldsEditor";
import "./flows.css";

export type FlowBuilderProps = {
  initialFlow: FlowDetailDTO;
  canEdit: boolean;
};

type DraftSettings = {
  name: string;
  instructions: string;
  allowedRole: FlowRoleDTO;
  fields: StepField[];
};

function statusTone(status: FlowDetailDTO["status"]): StatusTone {
  if (status === "published") return "success";
  if (status === "draft") return "info";
  return "muted";
}

function settingsFromStep(step: FlowStepDTO): DraftSettings {
  return {
    name: step.name,
    instructions: step.instructions ?? "",
    allowedRole: step.allowedRole,
    fields: step.fields.map((f) => ({ ...f })),
  };
}

function settingsEqual(a: DraftSettings, b: DraftSettings): boolean {
  return (
    a.name === b.name &&
    a.instructions === b.instructions &&
    a.allowedRole === b.allowedRole &&
    JSON.stringify(a.fields) === JSON.stringify(b.fields)
  );
}

export function FlowBuilder({ initialFlow, canEdit }: FlowBuilderProps) {
  const [flow, setFlow] = useState(initialFlow);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    initialFlow.steps[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<DraftSettings | null>(() => {
    const first = initialFlow.steps[0];
    return first ? settingsFromStep(first) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<"add" | "save" | "publish" | "remove" | "reorder" | null>(
    null,
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const selectedStep = useMemo(
    () => flow.steps.find((s) => s.id === selectedStepId) ?? null,
    [flow.steps, selectedStepId],
  );

  const dirty =
    canEdit && selectedStep && draft
      ? !settingsEqual(draft, settingsFromStep(selectedStep))
      : false;

  const archived = flow.status === "archived";
  const editable = canEdit && !archived;

  function selectStep(stepId: string) {
    if (stepId === selectedStepId) return;
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes to this step?");
      if (!ok) return;
    }
    setSelectedStepId(stepId);
    const step = flow.steps.find((s) => s.id === stepId);
    setDraft(step ? settingsFromStep(step) : null);
    setError(null);
    setMessage(null);
  }

  function applyFlow(next: FlowDetailDTO, preferStepId?: string | null) {
    setFlow(next);
    const keepId =
      preferStepId && next.steps.some((s) => s.id === preferStepId)
        ? preferStepId
        : (next.steps.find((s) => s.id === selectedStepId)?.id ?? next.steps[0]?.id ?? null);
    setSelectedStepId(keepId);
    const step = keepId ? next.steps.find((s) => s.id === keepId) : undefined;
    setDraft(step ? settingsFromStep(step) : null);
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    const index = flow.steps.findIndex((s) => s.id === stepId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= flow.steps.length) return;
    const ordered = flow.steps.map((s) => s.id);
    const tmp = ordered[index]!;
    ordered[index] = ordered[target]!;
    ordered[target] = tmp;

    setBusyKey("reorder");
    startTransition(async () => {
      try {
        const next = await reorderFlowSteps(flow.id, ordered);
        applyFlow(next, stepId);
        setMessage("Step order updated.");
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not reorder steps"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onAddStep() {
    setBusyKey("add");
    startTransition(async () => {
      try {
        const next = await addFlowStep(flow.id, {
          name: `Step ${flow.steps.length + 1}`,
          instructions: null,
          allowedRole: "builder",
          fields: [],
        });
        const newest = next.steps[next.steps.length - 1];
        applyFlow(next, newest?.id ?? null);
        setMessage("Step added.");
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not add step"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onSaveStep() {
    if (!selectedStep || !draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Step name is required.");
      return;
    }
    setBusyKey("save");
    startTransition(async () => {
      try {
        const next = await editFlowStep(flow.id, selectedStep.id, {
          name,
          instructions: draft.instructions.trim() ? draft.instructions.trim() : null,
          allowedRole: draft.allowedRole,
          fields: draft.fields,
        });
        applyFlow(next, selectedStep.id);
        setMessage("Step saved.");
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not save step"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onRemoveStep() {
    if (!selectedStep) return;
    setBusyKey("remove");
    startTransition(async () => {
      try {
        const next = await removeFlowStep(flow.id, selectedStep.id);
        applyFlow(next, null);
        setRemoveOpen(false);
        setMessage("Step removed.");
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not remove step"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onPublish() {
    setBusyKey("publish");
    startTransition(async () => {
      try {
        const next = await publishFlow(flow.id);
        applyFlow(next, selectedStepId);
        setPublishOpen(false);
        setMessage(
          next.publishedVersionNo != null
            ? `Published as version ${next.publishedVersionNo}.`
            : "Published.",
        );
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not publish flow"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  const previewFields = draft?.fields ?? selectedStep?.fields ?? [];

  return (
    <div>
      <div className="flow-page__header">
        <div>
          <p className="ui-hint" style={{ marginBottom: "0.35rem" }}>
            <Link href="/flows">← Flows</Link>
          </p>
          <div className="flow-card__title-row">
            <h1 style={{ marginBottom: 0 }}>{flow.name}</h1>
            <StatusChip tone={statusTone(flow.status)}>{flow.status}</StatusChip>
          </div>
          <p className="flow-page__lede">
            {flow.publishedVersionNo != null
              ? `Published version ${flow.publishedVersionNo}`
              : "Never published"}
            {flow.draftVersionId ? " · Editing draft" : ""}
            {archived ? " · Archived (read-only)" : ""}
            {!canEdit ? " · View only" : ""}
          </p>
        </div>
        <div className="flow-page__actions">
          {editable ? (
            <button
              type="button"
              className="ui-btn"
              disabled={pending || flow.steps.length === 0}
              onClick={() => setPublishOpen(true)}
            >
              {busyKey === "publish" ? "Publishing…" : "Publish"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flow-banner flow-banner--error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="flow-banner flow-banner--ok" role="status">
          {message}
        </div>
      ) : null}

      <div className="flow-builder">
        <section className="flow-builder__panel" aria-label="Steps">
          <h2>Steps</h2>
          {flow.steps.length === 0 ? (
            <p className="ui-hint">No steps yet.</p>
          ) : (
            <ol className="flow-step-list">
              {flow.steps.map((step, index) => (
                <li
                  key={step.id}
                  className="flow-step-list__item"
                  data-selected={step.id === selectedStepId ? "true" : undefined}
                >
                  <button
                    type="button"
                    className="flow-step-list__select"
                    onClick={() => selectStep(step.id)}
                  >
                    <span className="flow-step-list__name">
                      {step.stepNumber}. {step.name}
                    </span>
                    <span className="flow-step-list__meta">{step.allowedRole}</span>
                  </button>
                  {editable ? (
                    <div className="flow-step-list__moves">
                      <button
                        type="button"
                        aria-label={`Move ${step.name} up`}
                        disabled={pending || index === 0}
                        onClick={() => moveStep(step.id, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${step.name} down`}
                        disabled={pending || index === flow.steps.length - 1}
                        onClick={() => moveStep(step.id, 1)}
                      >
                        ▼
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {editable ? (
            <div className="flow-builder__toolbar">
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                disabled={pending}
                onClick={onAddStep}
              >
                {busyKey === "add" ? "Adding…" : "Add step"}
              </button>
            </div>
          ) : null}
        </section>

        <section className="flow-builder__panel" aria-label="Step settings">
          <h2>Step settings</h2>
          {!selectedStep || !draft ? (
            <p className="ui-hint">Select a step to edit its settings and fields.</p>
          ) : (
            <div className="flow-settings">
              <FormField name="step-name" label="Name" required htmlFor="step-name">
                <input
                  id="step-name"
                  className="ui-input"
                  value={draft.name}
                  disabled={!editable || pending}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </FormField>

              <FormField
                name="step-instructions"
                label="Instructions"
                htmlFor="step-instructions"
                hint="Shown to the person completing this step."
              >
                <textarea
                  id="step-instructions"
                  className="ui-input"
                  rows={4}
                  value={draft.instructions}
                  disabled={!editable || pending}
                  onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                />
              </FormField>

              <FormField name="step-role" label="Who can complete" required htmlFor="step-role">
                <select
                  id="step-role"
                  className="ui-input"
                  value={draft.allowedRole}
                  disabled={!editable || pending}
                  onChange={(e) =>
                    setDraft({ ...draft, allowedRole: e.target.value as FlowRoleDTO })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="builder">Builder</option>
                  <option value="viewer">Viewer</option>
                </select>
              </FormField>

              <div>
                <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>Fields</h3>
                <FieldsEditor
                  fields={draft.fields}
                  disabled={!editable || pending}
                  onChange={(fields) => setDraft({ ...draft, fields })}
                />
              </div>

              {editable ? (
                <div className="flow-builder__toolbar">
                  <button
                    type="button"
                    className="ui-btn"
                    disabled={pending || !dirty}
                    onClick={onSaveStep}
                  >
                    {busyKey === "save" ? "Saving…" : "Save step"}
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost"
                    disabled={pending}
                    onClick={() => setRemoveOpen(true)}
                  >
                    Remove step
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="flow-builder__panel" aria-label="Live preview">
          <h2>Live preview</h2>
          {previewFields.length === 0 ? (
            <p className="flow-preview__empty">
              {selectedStep
                ? "This step has no fields yet. Add fields to preview the form."
                : "Select a step to preview its form."}
            </p>
          ) : (
            <>
              {draft?.instructions ? (
                <p className="ui-hint" style={{ marginBottom: "1rem" }}>
                  {draft.instructions}
                </p>
              ) : null}
              <StepForm
                key={`${selectedStepId}-${previewFields.length}`}
                fields={previewFields}
                preview
              />
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={publishOpen}
        title="Publish this flow?"
        description="Publishing freezes the current draft as a new version. Invoices already running keep their version."
        confirmLabel="Publish"
        busy={pending}
        onCancel={() => setPublishOpen(false)}
        onConfirm={onPublish}
      />

      <ConfirmDialog
        open={removeOpen}
        title="Remove this step?"
        description={
          selectedStep ? `“${selectedStep.name}” will be removed from the draft.` : undefined
        }
        confirmLabel="Remove"
        danger
        busy={pending}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={onRemoveStep}
      />
    </div>
  );
}

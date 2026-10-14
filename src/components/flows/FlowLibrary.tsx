"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition, type FormEvent } from "react";
import { createFlowDraft, diffFlows, duplicateFlow, type FlowListItemDTO } from "@/actions/flows";
import { actionErrorMessage } from "@/lib/action-errors";
import type { AppRole } from "@/lib/nav";
import { EmptyState, StatusChip, type StatusTone } from "@/components/ui";
import "./flows.css";

export type FlowLibraryProps = {
  initialFlows: FlowListItemDTO[];
  role: AppRole;
};

function statusTone(status: FlowListItemDTO["status"]): StatusTone {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function FlowLibrary({ initialFlows, role }: FlowLibraryProps) {
  const canEdit = role === "admin" || role === "builder";
  const [flows, setFlows] = useState(initialFlows);
  const [selected, setSelected] = useState<string[]>([]);
  const [diffSteps, setDiffSteps] = useState<number[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPair = useMemo(() => {
    if (selected.length !== 2) return null;
    return [selected[0]!, selected[1]!] as [string, string];
  }, [selected]);

  const refreshDiff = useCallback((a: string, b: string) => {
    startTransition(async () => {
      try {
        const diff = await diffFlows(a, b);
        setDiffSteps(diff.differingStepNumbers);
        setError(null);
      } catch (err) {
        setDiffSteps([]);
        setError(actionErrorMessage(err, "Could not compare flows"));
      }
    });
  }, []);

  function toggleSelect(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : selected.length >= 2
        ? [selected[1]!, id]
        : [...selected, id];
    setSelected(next);
    if (next.length === 2) {
      refreshDiff(next[0]!, next[1]!);
    } else {
      setDiffSteps([]);
    }
    setMessage(null);
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await createFlowDraft(name);
        setFlows((prev) => [
          {
            id: created.id,
            name: created.name,
            status: created.status,
            publishedVersionNo: created.publishedVersionNo,
            steps: created.steps.map((s) => ({ stepNumber: s.stepNumber, name: s.name })),
            activeInvoiceCount: created.activeInvoiceCount,
          },
          ...prev,
        ]);
        setNewName("");
        setMessage(`Draft “${created.name}” created.`);
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not create draft"));
      }
    });
  }

  function onDuplicate(flowId: string) {
    startTransition(async () => {
      try {
        const created = await duplicateFlow(flowId);
        setFlows((prev) => [
          {
            id: created.id,
            name: created.name,
            status: created.status,
            publishedVersionNo: created.publishedVersionNo,
            steps: created.steps.map((s) => ({ stepNumber: s.stepNumber, name: s.name })),
            activeInvoiceCount: created.activeInvoiceCount,
          },
          ...prev,
        ]);
        setMessage(`Duplicated as “${created.name}”.`);
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not duplicate flow"));
      }
    });
  }

  return (
    <div>
      <div className="flow-page__header">
        <div>
          <h1>Flows</h1>
          <p className="flow-page__lede">
            Library of step-by-step templates. Select Standard and Courier (or any two) to highlight
            differing steps.
          </p>
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

      {canEdit ? (
        <form className="flow-create" onSubmit={onCreate}>
          <div className="flow-create__field">
            <label className="ui-label" htmlFor="new-flow-name">
              New draft name
            </label>
            <input
              id="new-flow-name"
              className="ui-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Export packing"
              disabled={pending}
              required
            />
          </div>
          <button type="submit" className="ui-btn" disabled={pending || !newName.trim()}>
            Create draft
          </button>
        </form>
      ) : null}

      <p className="flow-compare-hint">
        {selectedPair
          ? pending
            ? "Comparing selected flows…"
            : diffSteps.length > 0
              ? `Differing step numbers: ${diffSteps.join(", ")}.`
              : "Selected flows match at every step."
          : "Select two flows to compare step differences."}
      </p>

      {flows.length === 0 ? (
        <EmptyState
          title="No flows yet"
          description={
            canEdit
              ? "Create a draft above, or seed Standard and Courier from the database seed script."
              : "Ask an Admin or Builder to publish a flow."
          }
        />
      ) : (
        <div className="flow-library">
          {flows.map((flow) => {
            const isSelected = selected.includes(flow.id);
            return (
              <article
                key={flow.id}
                className="flow-card"
                data-selected={isSelected ? "true" : undefined}
              >
                <div className="flow-card__top">
                  <div>
                    <div className="flow-card__title-row">
                      <h2 className="flow-card__title">{flow.name}</h2>
                      <StatusChip tone={statusTone(flow.status)}>{flow.status}</StatusChip>
                    </div>
                    <div className="flow-card__meta">
                      <span>
                        {flow.publishedVersionNo != null
                          ? `Version ${flow.publishedVersionNo}`
                          : "Never published"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {flow.activeInvoiceCount} active invoice
                        {flow.activeInvoiceCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <label className="flow-card__select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(flow.id)}
                    />
                    Compare
                  </label>
                </div>

                <ol className="flow-step-chips" aria-label={`${flow.name} steps`}>
                  {flow.steps.length === 0 ? (
                    <li className="ui-hint">No steps yet</li>
                  ) : (
                    flow.steps.map((step) => {
                      const differs =
                        selectedPair !== null && isSelected && diffSteps.includes(step.stepNumber);
                      return (
                        <li
                          key={`${flow.id}-${step.stepNumber}`}
                          className="flow-step-chip"
                          data-diff={differs ? "true" : undefined}
                          title={differs ? "Differs from the other selected flow" : undefined}
                        >
                          <span className="flow-step-chip__num">{step.stepNumber}</span>
                          <span>{step.name}</span>
                        </li>
                      );
                    })
                  )}
                </ol>

                <div className="flow-card__footer">
                  {canEdit ? (
                    <>
                      <Link className="ui-btn" href={`/flows/${flow.id}/edit`}>
                        {flow.status === "archived" ? "View" : "Edit"}
                      </Link>
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost"
                        disabled={pending}
                        onClick={() => onDuplicate(flow.id)}
                      >
                        Duplicate
                      </button>
                    </>
                  ) : (
                    <span className="ui-hint">View only — editing requires Builder or Admin</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

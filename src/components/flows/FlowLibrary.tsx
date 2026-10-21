"use client";

import { useAppNavigate } from "@/lib/navigate";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  archiveFlow,
  createFlowDraft,
  diffFlows,
  duplicateFlow,
  unarchiveFlow,
  type FlowListItemDTO,
} from "@/actions/flows";
import { actionErrorMessage } from "@/lib/action-errors";
import type { AppRole } from "@/lib/nav";
import { IconMoreVertical } from "@/components/icons/Icons";
import { ConfirmDialog, EmptyState, StatusChip, type StatusTone } from "@/components/ui";
import "./flows.css";

export type FlowLibraryProps = {
  initialFlows: FlowListItemDTO[];
  role: AppRole;
};

function statusTone(status: FlowListItemDTO["status"]): StatusTone {
  if (status === "published") return "success";
  if (status === "draft") return "info";
  return "muted";
}

function nextUntitledName(flows: FlowListItemDTO[]): string {
  const base = "Untitled flow";
  const taken = new Set(flows.map((f) => f.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

type FlowCardMenuProps = {
  flow: FlowListItemDTO;
  canEdit: boolean;
  pending: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onCompare: () => void;
  onDelete: () => void;
  onRestore: () => void;
};

function FlowCardMenu({
  flow,
  canEdit,
  pending,
  onEdit,
  onDuplicate,
  onCompare,
  onDelete,
  onRestore,
}: FlowCardMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const editLabel = flow.status === "archived" ? "View" : "Edit";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flow-card__menu" ref={rootRef}>
      <button
        type="button"
        className="flow-card__menu-btn"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Actions for ${flow.name}`}
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconMoreVertical className="flow-card__menu-icon" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="flow-card__menu-panel"
          role="menu"
          aria-label={`${flow.name} actions`}
          onClick={(e) => e.stopPropagation()}
        >
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="flow-card__menu-item"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              {editLabel}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="flow-card__menu-item"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              Duplicate
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flow-card__menu-item"
            onClick={() => {
              setOpen(false);
              onCompare();
            }}
          >
            Compare steps
          </button>
          {canEdit && flow.status === "archived" ? (
            <button
              type="button"
              role="menuitem"
              className="flow-card__menu-item"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onRestore();
              }}
            >
              Restore
            </button>
          ) : null}
          {canEdit && flow.status !== "archived" ? (
            <button
              type="button"
              role="menuitem"
              className="flow-card__menu-item flow-card__menu-item--danger"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FlowLibrary({ initialFlows, role }: FlowLibraryProps) {
  const navigate = useAppNavigate();
  const canEdit = role === "admin" || role === "builder";
  const [flows, setFlows] = useState(initialFlows);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [diffSteps, setDiffSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  /** Per-action busy key so one card's mutation does not freeze the whole library. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selectedPair = useMemo(() => {
    if (selected.length !== 2) return null;
    return [selected[0]!, selected[1]!] as [string, string];
  }, [selected]);

  const deleteTarget = deleteId ? flows.find((f) => f.id === deleteId) : null;
  const comparing = busyKey === "compare";
  const creating = busyKey === "create";

  const refreshDiff = useCallback((a: string, b: string) => {
    setBusyKey("compare");
    startTransition(async () => {
      try {
        const diff = await diffFlows(a, b);
        setDiffSteps(diff.differingStepNumbers);
        setError(null);
      } catch (err) {
        setDiffSteps([]);
        setError(actionErrorMessage(err, "Could not compare flows"));
      } finally {
        setBusyKey(null);
      }
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareMode(false);
    setSelected([]);
    setDiffSteps([]);
  }, []);

  useEffect(() => {
    if (!compareMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") clearCompare();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compareMode, clearCompare]);

  function startCompare(flowId: string) {
    setCompareMode(true);
    setSelected([flowId]);
    setDiffSteps([]);
    setMessage(null);
    setError(null);
  }

  function onCardActivate(flowId: string) {
    if (!compareMode) return;
    if (selected.length === 0) {
      setSelected([flowId]);
      setDiffSteps([]);
      return;
    }
    if (selected.length === 1) {
      if (selected[0] === flowId) {
        setSelected([]);
        setDiffSteps([]);
        return;
      }
      const pair = [selected[0]!, flowId] as [string, string];
      setSelected(pair);
      refreshDiff(pair[0], pair[1]);
      return;
    }
    // Already have a pair — restart comparison with this card as the first pick.
    setSelected([flowId]);
    setDiffSteps([]);
  }

  function onCreate() {
    const name = nextUntitledName(flows);
    setBusyKey("create");
    startTransition(async () => {
      try {
        const created = await createFlowDraft(name);
        setError(null);
        setMessage(null);
        navigate.push(`/flows/${created.id}/edit`);
        navigate.refresh();
      } catch (err) {
        setError(actionErrorMessage(err, "Could not create flow"));
        setBusyKey(null);
      }
    });
  }

  function onDuplicate(flowId: string) {
    setBusyKey(`dup:${flowId}`);
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
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onConfirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setBusyKey(`del:${id}`);
    startTransition(async () => {
      try {
        const archived = await archiveFlow(id);
        setFlows((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  status: archived.status,
                  publishedVersionNo: archived.publishedVersionNo,
                }
              : f,
          ),
        );
        setDeleteId(null);
        setMessage(`“${archived.name}” deleted.`);
        setError(null);
        if (selected.includes(id)) clearCompare();
      } catch (err) {
        setError(actionErrorMessage(err, "Could not delete flow"));
        setDeleteId(null);
      } finally {
        setBusyKey(null);
      }
    });
  }

  function onRestore(flowId: string) {
    setBusyKey(`restore:${flowId}`);
    startTransition(async () => {
      try {
        const restored = await unarchiveFlow(flowId);
        setFlows((prev) =>
          prev.map((f) =>
            f.id === flowId
              ? {
                  ...f,
                  status: restored.status,
                  publishedVersionNo: restored.publishedVersionNo,
                }
              : f,
          ),
        );
        setMessage(
          restored.status === "published"
            ? `“${restored.name}” restored and available for new invoices.`
            : `“${restored.name}” restored as a draft.`,
        );
        setError(null);
      } catch (err) {
        setError(actionErrorMessage(err, "Could not restore flow"));
      } finally {
        setBusyKey(null);
      }
    });
  }

  const compareHint = !compareMode
    ? "Use Compare steps in a flow’s menu to start a comparison."
    : selectedPair
      ? comparing
        ? "Comparing selected flows…"
        : diffSteps.length > 0
          ? `Differing step numbers: ${diffSteps.join(", ")}.`
          : "Selected flows match at every step."
      : selected.length === 1
        ? "Click another flow to compare steps."
        : "Click a flow to start comparing.";

  return (
    <div data-compare-mode={compareMode ? "true" : undefined}>
      <div className="flow-page__header">
        <div>
          <h1>Flows</h1>
          <p className="flow-page__lede">
            Library of step-by-step templates. Use Compare steps to highlight differences between
            any two flows.
          </p>
        </div>
        {canEdit ? (
          <div className="flow-page__actions">
            <button type="button" className="ui-btn" disabled={creating} onClick={onCreate}>
              {creating ? "Creating…" : "Create flow"}
            </button>
          </div>
        ) : null}
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

      <p className="flow-compare-hint">
        {compareHint}
        {compareMode ? (
          <>
            {" "}
            <button type="button" className="flow-compare-hint__cancel" onClick={clearCompare}>
              Cancel
            </button>
          </>
        ) : null}
      </p>

      {flows.length === 0 ? (
        <EmptyState
          title="No flows yet"
          description={
            canEdit
              ? "Create a flow to get started, or seed Standard and Courier from the database seed script."
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
                data-compare-target={compareMode ? "true" : undefined}
                tabIndex={compareMode ? 0 : undefined}
                role={compareMode ? "button" : undefined}
                aria-pressed={compareMode ? isSelected : undefined}
                onClick={() => onCardActivate(flow.id)}
                onKeyDown={(e) => {
                  if (!compareMode) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardActivate(flow.id);
                  }
                }}
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
                  <FlowCardMenu
                    flow={flow}
                    canEdit={canEdit}
                    pending={
                      busyKey === `dup:${flow.id}` ||
                      busyKey === `del:${flow.id}` ||
                      busyKey === `restore:${flow.id}`
                    }
                    onEdit={() => navigate.push(`/flows/${flow.id}/edit`)}
                    onDuplicate={() => onDuplicate(flow.id)}
                    onCompare={() => startCompare(flow.id)}
                    onDelete={() => setDeleteId(flow.id)}
                    onRestore={() => onRestore(flow.id)}
                  />
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
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this flow?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be archived and can no longer start new invoices.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        busy={Boolean(deleteId && busyKey === `del:${deleteId}`)}
        onConfirm={onConfirmDelete}
        onCancel={() => {
          if (!busyKey?.startsWith("del:")) setDeleteId(null);
        }}
      />
    </div>
  );
}

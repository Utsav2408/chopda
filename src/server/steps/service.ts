/**
 * Invoice step completion (B5-05, B5-08).
 */
import { audit } from "../audit/write.js";
import { requireStepRole, type AuthContext } from "../authz/index.js";
import { withUser, type UserRole } from "../db/with-user.js";
import * as flowRepo from "../flows/repo.js";
import { parseFlowFields, validateStepData } from "../flows/schema.js";
import { isErr } from "../kernel/result.js";
import { Conflict, NotFound } from "../kernel/errors.js";
import { assertManualEmailRule } from "../invoices/email-rule.js";
import * as invoiceRepo from "../invoices/repo.js";
import { assertCanMutateInvoices, buildDetail, type InvoiceDetail } from "../invoices/service.js";
import type { CompleteStepInput } from "../invoices/schema.js";

/**
 * Complete an invoice step in one transaction (B5-05):
 * session + role + allowed_role + previous done + validateStepData +
 * forward-only + update current_step_id + invoice status.
 */
export async function complete(ctx: AuthContext, input: CompleteStepInput): Promise<InvoiceDetail> {
  // Completing a step is a write — Admin/Builder only at the invoice level;
  // requireStepRole further gates against the flow step's allowed_role.
  const authed = assertCanMutateInvoices(ctx);

  return withUser(authed, async (tx) => {
    const invoice = await invoiceRepo.getInvoiceById(tx, input.invoiceId);
    if (!invoice || invoice.deletedAt) {
      throw new NotFound();
    }
    if (invoice.status === "cancelled" || invoice.status === "completed") {
      throw new Conflict(`Cannot complete steps on a ${invoice.status} invoice`);
    }

    const steps = await invoiceRepo.listInvoiceStepsWithFlow(tx, invoice.id);
    const target = steps.find((s) => s.id === input.invoiceStepId);
    if (!target) {
      throw new NotFound();
    }

    if (target.status === "completed") {
      throw new Conflict("Step is already completed");
    }

    // Previous steps must be completed (in-order).
    const previous = steps.filter((s) => s.position < target.position);
    const incompletePrev = previous.find((s) => s.status !== "completed");
    if (incompletePrev) {
      throw new Conflict(
        `Step ${incompletePrev.position + 1} ("${incompletePrev.stepName}") must be completed first`,
      );
    }

    // Must be the current step (forward-only at service layer too).
    if (invoice.currentStepId !== target.flowStepId) {
      throw new Conflict("Only the current step can be completed");
    }

    requireStepRole(authed, target.allowedRole as UserRole);

    const fields = parseFlowFields(target.fields);
    const validated = validateStepData(fields, input.data);
    if (isErr(validated)) {
      throw validated.error;
    }

    // B5-08: courier / email steps require email_sent confirmation.
    assertManualEmailRule(fields, validated.value);

    const completedAt = new Date();
    const completed = await invoiceRepo.completeInvoiceStep(tx, target.id, {
      completedBy: authed.userId,
      completedAt,
      data: validated.value,
    });
    if (!completed) {
      // Lost a concurrent complete race (B9-04) or step flipped under us.
      throw new Conflict("Step is already completed");
    }

    const next = steps.find((s) => s.position === target.position + 1);
    const patch: {
      currentStepId: string | null;
      status?: string;
    } = {
      currentStepId: next ? next.flowStepId : null,
    };
    if (!next) {
      patch.status = "completed";
    }

    const updatedInvoice = await invoiceRepo.updateInvoiceRow(tx, invoice.id, patch);
    if (!updatedInvoice) throw new NotFound();

    await audit({
      tx,
      ctx: authed,
      action: "invoice.step.complete",
      entity: "invoice_step",
      entityId: target.id,
      before: { status: "open", invoiceId: invoice.id, flowStepId: target.flowStepId },
      after: {
        status: "completed",
        invoiceId: invoice.id,
        flowStepId: target.flowStepId,
        completedBy: authed.userId,
        nextStepId: next?.flowStepId ?? null,
        invoiceStatus: updatedInvoice.status,
      },
    });

    return buildDetail(tx, updatedInvoice);
  });
}

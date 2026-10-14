/**
 * Invoice + step engine public surface (B5). Prefer importing from here or via
 * `src/server/index.ts` from app/server code.
 */
export {
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
  completeStepInputSchema,
  listInvoicesQuerySchema,
  MAX_INVOICE_NO_LENGTH,
  MAX_PARTY_NAME_LENGTH,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type CompleteStepInput,
  type ListInvoicesQuery,
} from "./schema.js";

export {
  DEFAULT_WAITING_DAYS,
  deriveInvoiceStatus,
  daysOpen,
  type DerivedInvoiceStatus,
  type StatusDerivationInput,
} from "./status.js";

export {
  assertManualEmailRule,
  stepRequiresEmailSent,
  EMAIL_SENT_FIELD_KEY,
} from "./email-rule.js";

export {
  assertCanMutateInvoices,
  assertCanReadInvoices,
  create,
  update,
  get,
  buildDetail,
  type InvoiceDetail,
  type InvoiceStepDetail,
  type InvoiceDocumentRef,
} from "./service.js";

export {
  handleCreateInvoice,
  handleUpdateInvoice,
  handleGetInvoice,
  handleCompleteStep,
  mapErrorToHandlerResult,
  type HandlerResult,
} from "./handlers.js";

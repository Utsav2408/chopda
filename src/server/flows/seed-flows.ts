/**
 * Seed Standard + Courier flows through the service layer (B4-09).
 * Idempotent by template name. Diff must highlight step 4 only.
 */
import type { RequestContext } from "../db/with-user.js";
import type { FlowStepInput } from "./schema.js";
import * as flows from "./service.js";

const STANDARD_NAME = "Standard";
const COURIER_NAME = "Courier";

/** Shared steps 1–3 and 5; step 4 differs between Standard and Courier. */
const SHARED_PREFIX: FlowStepInput[] = [
  {
    name: "Invoice raised",
    instructions: "Record that the invoice has been raised.",
    allowedRole: "builder",
    fields: [{ key: "raised", label: "Invoice raised", type: "confirm", required: true }],
  },
  {
    name: "Upload invoice",
    instructions: "Upload the invoice PDF.",
    allowedRole: "builder",
    fields: [{ key: "invoice_file", label: "Invoice file", type: "file", required: true }],
  },
  {
    name: "Delivery challan uploaded",
    instructions: "Upload the delivery challan.",
    allowedRole: "builder",
    fields: [{ key: "challan", label: "Delivery challan", type: "file", required: true }],
  },
];

const SHARED_SUFFIX: FlowStepInput[] = [
  {
    name: "Payment verified",
    instructions: "Confirm payment has been received.",
    allowedRole: "admin",
    fields: [
      { key: "payment_confirmed", label: "Payment confirmed", type: "confirm", required: true },
    ],
  },
];

const STANDARD_STEP_4: FlowStepInput = {
  name: "Email sent",
  instructions: "Confirm the invoice email was sent to the party.",
  allowedRole: "builder",
  fields: [{ key: "email_sent", label: "I have sent the email", type: "confirm", required: true }],
};

const COURIER_STEP_4: FlowStepInput = {
  name: "Courier arranged and email sent",
  instructions: "Record courier details and confirm the email was sent. Proof upload is optional.",
  allowedRole: "builder",
  fields: [
    { key: "courier", label: "Courier name", type: "text", required: true },
    { key: "email_sent", label: "I have sent the email", type: "confirm", required: true },
    { key: "email_proof", label: "Email proof", type: "file", required: false },
  ],
};

async function buildAndPublish(
  ctx: RequestContext,
  name: string,
  step4: FlowStepInput,
): Promise<string> {
  const created = await flows.createDraft(ctx, { name });
  const allSteps = [...SHARED_PREFIX, step4, ...SHARED_SUFFIX];
  let detail = created;
  for (const step of allSteps) {
    detail = await flows.addStep(ctx, detail.id, step);
  }
  detail = await flows.publish(ctx, detail.id);
  return detail.id;
}

/**
 * Ensure Standard and Courier published flows exist. Returns their ids.
 * Safe to call repeatedly — skips a name that already exists.
 */
export async function seedStandardAndCourierFlows(
  ctx: RequestContext,
): Promise<{ standardId: string; courierId: string }> {
  const listed = await flows.list(ctx);
  let standardId = listed.find((f) => f.name === STANDARD_NAME)?.id;
  let courierId = listed.find((f) => f.name === COURIER_NAME)?.id;

  if (!standardId) {
    standardId = await buildAndPublish(ctx, STANDARD_NAME, STANDARD_STEP_4);
  }
  if (!courierId) {
    courierId = await buildAndPublish(ctx, COURIER_NAME, COURIER_STEP_4);
  }

  return { standardId, courierId };
}

export const SEED_FLOW_NAMES = { STANDARD_NAME, COURIER_NAME } as const;

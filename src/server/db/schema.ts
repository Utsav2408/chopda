/**
 * Drizzle table definitions mirroring hand-written SQL in db/migrations/.
 * RLS, triggers, DB roles, and some partial indexes live only in SQL —
 * drizzle-kit cannot express them. Keep this file in sync with migrations;
 * `pnpm db:generate` + migration-drift CI fail if they diverge.
 *
 * No "server-only" import: seed/migrate scripts and typed queries both use this.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const userRoleEnum = pgEnum("user_role", ["admin", "builder", "viewer"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: citext("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    photoObjectKey: text("photo_object_key"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_unique").on(t.username),
    uniqueIndex("one_admin")
      .on(t.role)
      .where(sql`${t.role} = 'admin'`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash)],
);

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: citext("username").notNull(),
  ip: text("ip").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    requestId: text("request_id"),
  },
  (t) => [index("audit_log_entity_id_at_idx").on(t.entity, t.entityId, t.at)],
);

export const flowTemplates = pgTable(
  "flow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("flow_templates_status_check", sql`${t.status} IN ('draft', 'published', 'archived')`),
  ],
);

export const flowVersions = pgTable(
  "flow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => flowTemplates.id),
    versionNo: integer("version_no").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("flow_versions_template_version_unique").on(t.templateId, t.versionNo)],
);

export const flowSteps = pgTable(
  "flow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => flowVersions.id),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    instructions: text("instructions"),
    allowedRole: userRoleEnum("allowed_role").notNull(),
    fields: jsonb("fields")
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    unique("flow_steps_version_position_unique").on(t.versionId, t.position),
    check("flow_steps_fields_is_array", sql`jsonb_typeof(${t.fields}) = 'array'`),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNo: text("invoice_no").notNull(),
    flowVersionId: uuid("flow_version_id")
      .notNull()
      .references(() => flowVersions.id),
    currentStepId: uuid("current_step_id").references(() => flowSteps.id),
    status: text("status").notNull().default("open"),
    partyName: text("party_name").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    extra: jsonb("extra")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("invoices_invoice_no_unique").on(t.invoiceNo),
    check("invoices_amount_minor_nonneg", sql`${t.amountMinor} >= 0`),
    index("invoices_owner_id_idx").on(t.ownerId),
    index("invoices_flow_version_id_idx").on(t.flowVersionId),
    index("invoices_current_step_id_idx").on(t.currentStepId),
    index("invoices_status_due")
      .on(t.status, t.dueDate)
      .where(sql`${t.deletedAt} IS NULL`),
    // B7-02: list keyset/sort, date-range filter, purge/listDeleted candidates
    index("invoices_created_at_id_idx").on(t.createdAt, t.id),
    index("invoices_issue_date_idx").on(t.issueDate),
    index("invoices_deleted_at_idx")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NOT NULL`),
  ],
);

export const invoiceSteps = pgTable(
  "invoice_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    flowStepId: uuid("flow_step_id")
      .notNull()
      .references(() => flowSteps.id),
    status: text("status").notNull().default("open"),
    completedBy: uuid("completed_by").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    data: jsonb("data")
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    unique("invoice_steps_invoice_flow_step_unique").on(t.invoiceId, t.flowStepId),
    check("invoice_steps_data_is_object", sql`jsonb_typeof(${t.data}) = 'object'`),
    index("invoice_steps_invoice_id_idx").on(t.invoiceId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceStepId: uuid("invoice_step_id")
      .notNull()
      .references(() => invoiceSteps.id),
    storageProvider: text("storage_provider").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    sha256: text("sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "bigint" }).notNull(),
    scanStatus: text("scan_status").notNull().default("pending"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // B7-02 / B7-09: shared-key purge safety + live size SUM
    index("documents_object_key_idx").on(t.objectKey),
    index("documents_live_idx")
      .on(t.id)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const companyProfile = pgTable(
  "company_profile",
  {
    id: integer("id").primaryKey().default(1),
    legalName: text("legal_name").notNull(),
    gstin: text("gstin"),
    panEncrypted: text("pan_encrypted"),
    invoiceDefaults: jsonb("invoice_defaults")
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("company_profile_singleton", sql`${t.id} = 1`)],
);

export const companyBankAccounts = pgTable(
  "company_bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    bankName: text("bank_name").notNull(),
    accountHolder: text("account_holder").notNull(),
    branch: text("branch"),
    accountNumberEncrypted: text("account_number_encrypted").notNull(),
    ifscEncrypted: text("ifsc_encrypted").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("one_default_active_bank")
      .on(t.isDefault)
      .where(sql`${t.isActive} AND ${t.isDefault}`),
  ],
);

export const reminderState = pgTable(
  "reminder_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    reminderKey: text("reminder_key").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("reminder_state_user_key_unique").on(t.userId, t.reminderKey)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs")
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Daily R2 / storage Class A / Class B operation counters (B9-08g).
 * Free-tier budgets: 1M Class A / 10M Class B per month; health alerts at 70%/90%.
 */
export const storageOpsDaily = pgTable("storage_ops_daily", {
  day: date("day").primaryKey(),
  classA: bigint("class_a", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  classB: bigint("class_b", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
});

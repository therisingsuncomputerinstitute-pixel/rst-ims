import crypto from "node:crypto";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  boolean,
  integer,
  uuid,
  jsonb,
  unique,
  check,
  vector,
  real,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const role = pgEnum("role", ["student", "admin"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role").default("student").notNull(),
  banned: boolean("banned").default(false).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id").references(
      () => organization.id,
      { onDelete: "set null" },
    ),
    activeWorkspaceId: uuid("active_workspace_id").references(
      () => workspaces.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    metadata: text("metadata"),
    status: text("status", { enum: ["active", "deactivated"] })
      .default("active")
      .notNull(),
    inviteCode: text("invite_code").unique(),
    plan: text("plan", { enum: ["fast", "basic", "plus"] })
      .default("fast")
      .notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelAt: timestamp("cancel_at"),
  canceledAt: timestamp("canceled_at"),
  endedAt: timestamp("ended_at"),
  seats: integer("seats"),
  billingInterval: text("billing_interval"),
  stripeScheduleId: text("stripe_schedule_id"),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  stripePriceId: text("stripe_price_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const customer = pgTable("customer", {
  id: text("id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").default("general").notNull(), // e.g. "reinsurance", "property"
    isGlobal: boolean("is_global").notNull().default(false),
    mandatoryRegistry: jsonb("mandatory_registry").default([]), // For Fast Checklist deterministic matching
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceOrgIdx: index("workspace_organization_idx").on(
      table.organizationId,
    ),
    workspaceGlobalIdx: index("workspace_global_idx").on(table.isGlobal),
    workspaceOrgTypeGlobalUnique: uniqueIndex(
      "workspace_org_type_global_unique",
    )
      .on(table.organizationId, table.type)
      .where(sql`${table.isGlobal} = true`),
  }),
);

export const workspaceAccess = pgTable(
  "workspace_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceAccessUserIdx: index("workspace_access_user_idx").on(table.userId),
    workspaceAccessWorkspaceIdx: index("workspace_access_workspace_idx").on(
      table.workspaceId,
    ),
    workspaceUserUnique: uniqueIndex("workspace_user_uidx").on(
      table.workspaceId,
      table.userId,
    ),
  }),
);

export const member = pgTable(
  "member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("student").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_user_org_uidx").on(table.userId, table.organizationId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: role("role").default("student").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviteCode: text("invite_code").unique(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  joinRequests: many(joinRequests),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export type Organization = typeof organization.$inferSelect;

export type Role = (typeof role.enumValues)[number];

export type Member = typeof member.$inferSelect & {
  user: typeof user.$inferSelect;
};

export type User = typeof user.$inferSelect;

export const contracts: any = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").notNull(),
    contractName: text("contract_name").notNull(),
    reinsured: text("reinsured").notNull(),
    broker: text("broker"),
    contractType: text("contract_type").notNull().default("other"),
    tags: text("tags")
      .array()
      .default(sql`ARRAY[]::text[]`),
    periodFrom: timestamp("period_from", { withTimezone: true }),
    periodTo: timestamp("period_to", { withTimezone: true }),
    executionDate: timestamp("execution_date", { withTimezone: true }),
    fileURL: text("file_url"),
    fileHash: text("file_hash"),
    fileContent: text("file_content"),
    structuredContent: jsonb("structured_content"),
    analysis: jsonb("analysis"),
    riskScore: integer("risk_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    fileSize: integer("file_size"),
    currentVersionId: uuid("current_version_id").references(
      () => contractVersions.id,
      { onDelete: "set null" },
    ),
    contractStatus: text("contract_status").default("uploaded").notNull(),
    analysisStage: text("analysis_stage").default("idle").notNull(), // idle, ocr, fast, deep, completed, failed
    analysisProgress: integer("analysis_progress").default(0),
    analysisStatus: text("analysis_status"), // Human-readable status message (e.g. "[1/5] Initializing...")
    totalRules: integer("total_rules").default(0),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    selectedRuleIds: text("selected_rule_ids")
      .array()
      .default(sql`ARRAY[]::text[]`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    contractsIdxOrg: index("contracts_organization_id_idx").on(
      table.organizationId,
    ),
    contractsIdxUserId: index("contracts_user_id_idx").on(table.userId),
    contractsIdxReinsured: index("contracts_reinsured_idx").on(table.reinsured),
    contractsIdxBroker: index("contracts_broker_idx").on(table.broker),
    contractsIdxType: index("contracts_type_idx").on(table.contractType),
    contractsIdxCreatedAt: index("contracts_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const contractVersions: any = pgTable(
  "contract_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    versionNumber: integer("version_number").notNull(),

    fileURL: text("file_url"),
    fileContent: text("file_content"),
    structuredContent: jsonb("structured_content"),

    analysis: jsonb("analysis"),
    riskScore: integer("risk_score"),

    createdBy: text("created_by"),
    changeNote: text("change_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    contractVersionsContractIdx: index("contract_versions_contract_idx").on(
      table.contractId,
    ),

    contractVersionUnique: unique("contract_version_unique").on(
      table.contractId,
      table.versionNumber,
    ),
  }),
);

export const contractChunks = pgTable(
  "contract_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),

    content: text("content").notNull(),
    sourceFileName: text("source_file_name"),

    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (table) => ({
    contractChunksVersionIdx: index("contract_chunks_version_idx").on(
      table.contractVersionId,
    ),
    contractChunksEmbeddingIdx: index("contract_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

export type Contracts = typeof contracts.$inferSelect;

export const clauseCategoryEnum = pgEnum("clause_category", [
  "Exclusions",
  "Claims",
  "Premium & Payments",
  "Placement & Subscription",
  "Compliance",
  "Information & Records",
  "Disputes",
  "Parties & Definitions",
  "Termination",
  "Other",
]);

export const clauses = pgTable(
  "clauses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    isGlobal: boolean("is_global").notNull().default(false),
    clauseName: text("clause_name").notNull(),
    category: clauseCategoryEnum("clause_category").notNull(),
    clauseText: text("clause_text").notNull(),
    heading: text("heading"),
    source: text("source"),
    library: text("library").notNull(),
    status: text("status", { enum: ["Approved", "Not Approved"] })
      .default("Approved")
      .notNull(),
    approvalStatus: text("approval_status", {
      enum: ["Approved", "Not Approved"],
    })
      .default("Approved")
      .notNull(),
    aiSummary: text("ai_summary"),

    aiFavorability: text("ai_favorability"),

    aiRecommendedUse: text("ai_recommended_use").array(),

    aiNote: text("ai_note"),

    keywords: text("keywords")
      .array()
      .default(sql`ARRAY[]::text[]`),

    aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),

    aiVersion: text("ai_version"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    metadata: jsonb("metadata"),
    code: text("code"),
  },
  (table) => ({
    clausesIdxOrg: index("clauses_organization_idx").on(table.organizationId),
    clausesIdxWorkspace: index("clauses_workspace_idx").on(table.workspaceId),
    clausesIdxCategory: index("clauses_category_idx").on(table.category),
    clausesIdxLibrary: index("clauses_library_idx").on(table.library),
  }),
);

export type Clauses = typeof clauses.$inferSelect;

export const clauseVersions = pgTable(
  "clause_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    clauseId: uuid("clause_id")
      .notNull()
      .references(() => clauses.id, { onDelete: "cascade" }),

    versionNumber: integer("version_number").notNull(),

    clauseText: text("clause_text").notNull(),
    heading: text("heading"),
    source: text("source"),

    aiSummary: text("ai_summary"),
    aiFavorability: text("ai_favorability"),
    aiRecommendedUse: text("ai_recommended_use").array(),
    aiNote: text("ai_note"),
    keywords: text("keywords")
      .array()
      .default(sql`ARRAY[]::text[]`),

    changedByName: text("changed_by_name").notNull(),
    changeNote: text("change_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    clauseVersionsClauseIdx: index("clause_versions_clause_idx").on(
      table.clauseId,
    ),

    clauseVersionUnique: unique("clause_version_unique").on(
      table.clauseId,
      table.versionNumber,
    ),
  }),
);

export const clausesRelations = relations(clauses, ({ one, many }) => ({
  organization: one(organization, {
    fields: [clauses.organizationId],
    references: [organization.id],
  }),
  versions: many(clauseVersions),
  chunks: many(clauseChunks),
}));

export const clauseChunks = pgTable(
  "clause_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clauseId: uuid("clause_id")
      .notNull()
      .references(() => clauses.id, { onDelete: "cascade" }),

    content: text("content").notNull(),

    library: text("library"),
    category: text("category"),

    embedding: vector("embedding", { dimensions: 1024 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    clauseChunksEmbeddingIdx: index("clause_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

export const clauseChunksRelations = relations(clauseChunks, ({ one }) => ({
  clause: one(clauses, {
    fields: [clauseChunks.clauseId],
    references: [clauses.id],
  }),
}));

export const analyzedClauses = pgTable(
  "analyzed_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    clauseIdentifier: text("clause_identifier"), // Clause Number/Short Title
    clauseText: text("clause_text").notNull(),
    category: text("category"),
    confidence: real("confidence"),
    metadata: jsonb("metadata"), // Positions, offsets, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    analyzedClausesContractIdx: index("analyzed_clauses_contract_idx").on(
      table.contractId,
    ),
    analyzedClausesVersionIdx: index("analyzed_clauses_version_idx").on(
      table.contractVersionId,
    ),
  }),
);

export const analyzedClausesRelations = relations(
  analyzedClauses,
  ({ one }) => ({
    contract: one(contracts, {
      fields: [analyzedClauses.contractId],
      references: [contracts.id],
    }),
    version: one(contractVersions, {
      fields: [analyzedClauses.contractVersionId],
      references: [contractVersions.id],
    }),
  }),
);

export const ruleStatusEnum = pgEnum("rule_status", ["active", "inactive"]);

export const ruleResultStatusEnum = pgEnum("rule_result_status", [
  "Green",
  "Amber",
  "Red",
]);

export const workspaceRules = pgTable(
  "workspace_rules",
  {
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    ruleId: uuid("rule_id")
      .references(() => rules.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.ruleId] }),
  }),
);

export const workspaceClauses = pgTable(
  "workspace_clauses",
  {
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    clauseId: uuid("clause_id")
      .references(() => clauses.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.clauseId] }),
  }),
);

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    isGlobal: boolean("is_global").notNull().default(false),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    currentVersionId: uuid("current_version_id").references(
      () => ruleVersions.id,
      { onDelete: "set null" },
    ),
    status: ruleStatusEnum("status").notNull().default("active"),
    approvalStatus: text("approval_status", {
      enum: ["Approved", "Not Approved"],
    })
      .default("Approved")
      .notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    rulesIdxOrg: index("rules_organization_idx").on(table.organizationId),
    rulesIdxWorkspace: index("rules_workspace_idx").on(table.workspaceId),
    rulesIdxGlobal: index("rules_is_global_idx").on(table.isGlobal),
    rulesIdxCategory: index("rules_category_idx").on(table.category),
    rulesIdxStatus: index("rules_status_idx").on(table.status),
    nameOrgUnique: unique("rules_name_organization_unique").on(
      table.name,
      table.organizationId,
    ),
    ruleScopeCheck: check(
      "rule_scope_check",
      sql`${table.organizationId} IS NOT NULL`,
    ),
  }),
);

export const ruleVersions: any = pgTable(
  "rule_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    ruleDefinition: jsonb("rule_definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    ruleVersionsRuleIdx: index("rule_versions_rule_idx").on(table.ruleId),
    ruleVersionUnique: unique("rule_version_unique").on(
      table.ruleId,
      table.versionNumber,
    ),
    ruleDefinitionIdx: index("rule_definition_gin_idx").using(
      "gin",
      table.ruleDefinition,
    ),
  }),
);

export const ruleResults = pgTable(
  "rule_results",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id),
    ruleVersionId: uuid("rule_version_id")
      .notNull()
      .references(() => ruleVersions.id, { onDelete: "cascade" }),
    status: ruleResultStatusEnum("status").notNull(),
    reasoning: text("reasoning").notNull(),
    evidence: jsonb("evidence").notNull(),
    confidence: real("confidence"),
    triggeredConditions: jsonb("triggered_conditions"), // Matched acceptance criteria
    keyTerms: text("key_terms").array(), // Identified key concepts
    comments: text("comments"),
    granularGuidance: jsonb("granular_guidance"), // Specialized guidance for complex rules
    bias: text("bias"), // Balanced, Cedant, Reinsurer
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ruleResultsContractIdx: index("rule_results_contract_idx").on(
      table.contractId,
    ),
    ruleResultsRuleIdx: index("rule_results_rule_idx").on(table.ruleId),
    ruleResultsVersionIdx: index("rule_results_rule_version_idx").on(
      table.ruleVersionId,
    ),
    ruleResultsStatusIdx: index("rule_results_status_idx").on(table.status),
    ruleResultsUnique: unique("rule_results_unique").on(
      table.contractId,
      table.ruleVersionId,
    ),
  }),
);

export const ruleClauseMatches = pgTable("rule_clause_matches", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  ruleResultId: uuid("rule_result_id").references(() => ruleResults.id, {
    onDelete: "cascade",
  }),
  clauseId: uuid("clause_id"),
  score: real("score"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const organizationRuleSettings = pgTable(
  "organization_rule_settings",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    status: ruleStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    orgRuleUnique: unique("organization_rule_unique").on(
      table.organizationId,
      table.ruleId,
    ),
  }),
);

export type Rules = typeof rules.$inferSelect;
export type RuleVersions = typeof ruleVersions.$inferSelect;
export type RuleResults = typeof ruleResults.$inferSelect;

export const rulesRelations = relations(rules, ({ one, many }) => ({
  organization: one(organization, {
    fields: [rules.organizationId],
    references: [organization.id],
  }),
  versions: many(ruleVersions),
  currentVersion: one(ruleVersions, {
    fields: [rules.currentVersionId],
    references: [ruleVersions.id],
  }),
}));

export const ruleVersionsRelations = relations(
  ruleVersions,
  ({ one, many }) => ({
    rule: one(rules, {
      fields: [ruleVersions.ruleId],
      references: [rules.id],
    }),
    results: many(ruleResults),
  }),
);

export const ruleResultsRelations = relations(ruleResults, ({ one, many }) => ({
  rule: one(rules, {
    fields: [ruleResults.ruleId],
    references: [rules.id],
  }),
  ruleVersion: one(ruleVersions, {
    fields: [ruleResults.ruleVersionId],
    references: [ruleVersions.id],
  }),
  clauseMatches: many(ruleClauseMatches),
}));

export const ruleClauseMatchesRelations = relations(
  ruleClauseMatches,
  ({ one }) => ({
    ruleResult: one(ruleResults, {
      fields: [ruleClauseMatches.ruleResultId],
      references: [ruleResults.id],
    }),
  }),
);

export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const joinRequests = pgTable(
  "join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    joinRequestsUserOrgUnique: unique("join_requests_user_org_unique").on(
      table.userId,
      table.organizationId,
    ),
  }),
);

export const joinRequestsRelations = relations(joinRequests, ({ one }) => ({
  user: one(user, {
    fields: [joinRequests.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [joinRequests.organizationId],
    references: [organization.id],
  }),
}));

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // "created", "updated", "deleted"
    entityType: text("entity_type").notNull(), // "contract", "clause", "rule"
    entityId: uuid("entity_id").notNull(),
    entityName: text("entity_name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    activityLogUserIdx: index("activity_log_user_idx").on(table.userId),
    activityLogOrgIdx: index("activity_log_org_idx").on(table.organizationId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // Nullable for global/org-wide
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"), // "info", "warning", "success", "error"
    isRead: boolean("is_read").default(false).notNull(),
    isGlobal: boolean("is_global").default(false).notNull(), // For super admin pushes
    link: text("link"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    notifUserIdx: index("notif_user_idx").on(table.userId),
    notifOrgIdx: index("notif_org_idx").on(table.organizationId),
    notifReadIdx: index("notif_read_idx").on(table.isRead),
  }),
);

export const organizationRuleSettingsRelations = relations(
  organizationRuleSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationRuleSettings.organizationId],
      references: [organization.id],
    }),
    rule: one(rules, {
      fields: [organizationRuleSettings.ruleId],
      references: [rules.id],
    }),
  }),
);

export const warExclusions = pgTable(
  "war_exclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    clauseText: text("clause_text").notNull(),
    category: text("category"), // e.g. "War", "Terrorism"
    bias: text("bias"), // e.g. "Cedant", "Reinsurer", "Balanced"
    type: text("type"), // e.g. "Exclusion", "Limitation"
    treatyFac: text("treaty_fac"), // e.g. "Treaty", "Fac"
    conditions: jsonb("conditions"), // e.g. { war: "Cedant", rebellion: "Balanced" }
    keywords: text("keywords").array(),
    legalComments: text("legal_comments"),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    warExclusionsOrgIdx: index("war_exclusions_org_idx").on(
      table.organizationId,
    ),
    warExclusionsEmbeddingIdx: index("war_exclusions_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

export const warExclusionsRelations = relations(warExclusions, ({ one }) => ({
  organization: one(organization, {
    fields: [warExclusions.organizationId],
    references: [organization.id],
  }),
}));

export const chatbotUsage = pgTable(
  "chatbot_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD
    messageCount: integer("message_count").default(0).notNull(),
    tokenCount: integer("token_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    orgDayUnique: uniqueIndex("chatbot_usage_org_day_uidx").on(
      table.organizationId,
      table.day,
    ),
  }),
);

export const analysisEvents = pgTable(
  "analysis_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clauseId: uuid("clause_id").references(() => clauses.id, {
      onDelete: "set null",
    }),
    ruleId: uuid("rule_id").references(() => rules.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(), // e.g. "clause_detected", "rule_evaluated"
    status: text("status"), // "Green", "Amber", "Red", "Found", "Missing"
    riskScore: integer("risk_score"),
    metadata: jsonb("metadata"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    eventWorkspaceIdx: index("event_workspace_idx").on(table.workspaceId),
    eventContractIdx: index("event_contract_idx").on(table.contractId),
    eventTypeIdx: index("event_type_idx").on(table.eventType),
  }),
);

// Structured evidence items table - stores clause-linked evidence from rule evaluations
export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleResultId: uuid("rule_result_id")
      .notNull()
      .references(() => ruleResults.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    section: text("section").notNull(), // e.g., "Termination", "Liability"
    clauseType: text("clause_type").notNull(),
    text: text("text").notNull(), // Clean extracted text
    libraryClauseId: uuid("library_clause_id").references(() => clauses.id, {
      onDelete: "set null",
    }),
    matchConfidence: real("match_confidence").default(0), // 0-1 score
    isManuallyMatched: boolean("is_manually_matched").default(false),
    sourceChunk: text("source_chunk"), // Original text before cleaning
    sourcePosition: integer("source_position"),
    sourceFileName: text("source_file_name"),
    similarity: real("similarity"), // Original similarity score
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    evidenceRuleResultIdx: index("evidence_rule_result_idx").on(
      table.ruleResultId,
    ),
    evidenceContractIdx: index("evidence_contract_idx").on(table.contractId),
    evidenceLibraryClauseIdx: index("evidence_library_clause_idx").on(
      table.libraryClauseId,
    ),
    evidenceSectionIdx: index("evidence_section_idx").on(table.section),
  }),
);

// Evidence-clause mapping table for tracking manual overrides and audit trail
export const evidenceClauseMatches = pgTable(
  "evidence_clause_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItems.id, { onDelete: "cascade" }),
    libraryClauseId: uuid("library_clause_id")
      .notNull()
      .references(() => clauses.id, { onDelete: "cascade" }),
    matchConfidence: real("match_confidence").default(0), // 0-1 score
    isManualOverride: boolean("is_manual_override").default(false),
    overriddenBy: text("overridden_by"), // User ID who made the override
    reason: text("reason"), // Why was the override made
    matchedAt: timestamp("matched_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    matchEvidenceIdx: index("match_evidence_idx").on(table.evidenceItemId),
    matchClauseIdx: index("match_clause_idx").on(table.libraryClauseId),
  }),
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    instructorName: text("instructor_name"),
    term: text("term"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("courses_org_idx").on(table.organizationId)],
);

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_enrollment_uidx").on(table.courseId, table.studentId),
    index("course_enrollment_student_idx").on(table.studentId),
  ],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    durationMinutes: integer("duration_minutes").default(15),
    totalQuestions: integer("total_questions").default(0),
    maxScore: real("max_score").notNull().default(0),
    isPublished: boolean("is_published").default(false).notNull(),
    dueAt: timestamp("due_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("quizzes_course_idx").on(table.courseId)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["mcq", "true_false"] })
      .default("mcq")
      .notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options"), // [{ id: string, text: string }]
    correctAnswer: jsonb("correct_answer"), // mcq: string[] of option ids, true_false: [true] | [false]
    points: real("points").notNull().default(1),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("quiz_questions_quiz_idx").on(table.quizId)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    answers: jsonb("answers"), // [{ questionId, selected: string[], text? }]
    scoreEarned: real("score_earned").notNull().default(0),
    scoreTotal: real("score_total").notNull().default(0),
    status: text("status", { enum: ["in_progress", "submitted"] })
      .default("in_progress")
      .notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("quiz_attempt_uidx").on(table.quizId, table.studentId),
    index("quiz_attempt_student_idx").on(table.studentId),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    maxScore: real("max_score").notNull().default(0),
    isPublished: boolean("is_published").default(false).notNull(),
    dueAt: timestamp("due_at"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [index("assignments_course_idx").on(table.courseId)],
);

export const assignmentAttachments = pgTable(
  "assignment_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["instructions", "reference"] })
      .notNull()
      .default("reference"),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("assignment_attachments_assign_idx").on(table.assignmentId)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileName: text("file_name"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    comments: text("comments"),
    status: text("status", { enum: ["submitted", "graded"] })
      .default("submitted")
      .notNull(),
    grade: real("grade"),
    feedback: text("feedback"),
    gradedBy: text("graded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    gradedAt: timestamp("graded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("submission_uidx").on(table.assignmentId, table.studentId),
    index("submission_student_idx").on(table.studentId),
  ],
);

export const coursesRelations = relations(courses, ({ many }) => ({
  quizzes: many(quizzes),
  assignments: many(assignments),
  courseEnrollments: many(courseEnrollments),
}));

export const courseEnrollmentsRelations = relations(
  courseEnrollments,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseEnrollments.courseId],
      references: [courses.id],
    }),
    student: one(user, {
      fields: [courseEnrollments.studentId],
      references: [user.id],
    }),
  }),
);

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  student: one(user, {
    fields: [quizAttempts.studentId],
    references: [user.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(courses, {
    fields: [assignments.courseId],
    references: [courses.id],
  }),
  submissions: many(submissions),
  attachments: many(assignmentAttachments),
}));

export const assignmentAttachmentsRelations = relations(
  assignmentAttachments,
  ({ one }) => ({
    assignment: one(assignments, {
      fields: [assignmentAttachments.assignmentId],
      references: [assignments.id],
    }),
  }),
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(user, {
    fields: [submissions.studentId],
    references: [user.id],
  }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  organization,
  workspaces,
  workspaceAccess,
  member,
  invitation,
  userRelations,
  sessionRelations,
  accountRelations,
  organizationRelations,
  memberRelations,
  invitationRelations,
  contracts,
  contractVersions,
  contractChunks,
  clauses,
  clausesRelations,
  clauseVersions,
  clauseChunks,
  analyzedClauses,
  analyzedClausesRelations,
  rules,
  rulesRelations,
  ruleVersions,
  ruleVersionsRelations,
  ruleResults,
  ruleResultsRelations,
  ruleClauseMatches,
  ruleClauseMatchesRelations,
  organizationRuleSettings,
  organizationRuleSettingsRelations,
  joinRequests,
  joinRequestsRelations,
  activityLog,
  notifications,
  warExclusions,
  warExclusionsRelations,
  analysisEvents,
  evidenceItems,
  evidenceClauseMatches,
  subscription,
  customer,
  courses,
  courseEnrollments,
  quizzes,
  quizQuestions,
  quizAttempts,
  assignments,
  submissions,
  assignmentAttachments,
  coursesRelations,
  courseEnrollmentsRelations,
  quizzesRelations,
  quizQuestionsRelations,
  quizAttemptsRelations,
  assignmentsRelations,
  submissionsRelations,
  assignmentAttachmentsRelations,
};

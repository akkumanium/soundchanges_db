import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const nodeKindEnum = pgEnum("node_kind", ["family", "subgroup", "stage", "language", "variety"]);
export const relationshipKindEnum = pgEnum("relationship_kind", ["contains", "descends_from"]);
export const moderatorRoleEnum = pgEnum("moderator_role", ["moderator", "admin"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const lineageNodes = pgTable(
  "lineage_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    kind: nodeKindEnum("kind").notNull(),
    description: text("description").notNull().default(""),
    parentId: uuid("parent_id").references((): AnyPgColumn => lineageNodes.id, { onDelete: "restrict" }),
    relationshipKind: relationshipKindEnum("relationship_kind").notNull().default("contains"),
    sortOrder: integer("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    isDemo: boolean("is_demo").notNull().default(false),
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("approved"),
    submittedBy: uuid("submitted_by"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lineage_nodes_slug_idx").on(table.slug),
    index("lineage_nodes_parent_idx").on(table.parentId, table.sortOrder),
  ],
);

export const transitions = pgTable(
  "transitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    sourceNodeId: uuid("source_node_id").notNull().references(() => lineageNodes.id, { onDelete: "restrict" }),
    targetNodeId: uuid("target_node_id").notNull().references(() => lineageNodes.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    chronology: text("chronology").notNull().default(""),
    summary: text("summary").notNull().default(""),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("transitions_slug_idx").on(table.slug),
    index("transitions_source_idx").on(table.sourceNodeId),
    index("transitions_target_idx").on(table.targetNodeId),
  ],
);

export const soundChanges = pgTable(
  "sound_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transitionId: uuid("transition_id").notNull().references(() => transitions.id, { onDelete: "cascade" }),
    input: text("input").notNull().default(""),
    output: text("output").notNull().default(""),
    environment: text("environment").notNull().default(""),
    exceptions: text("exceptions").notNull().default(""),
    exceptionExamples: text("exception_examples").array().notNull().default([]),
    qualifier: text("qualifier").notNull().default(""),
    explanation: text("explanation").notNull().default(""),
    displayNotation: text("display_notation").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("approved"),
    submittedBy: uuid("submitted_by"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sound_changes_transition_idx").on(table.transitionId, table.sortOrder),
  ],
);

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayCitation: text("display_citation").notNull(),
  authors: text("authors").notNull().default(""),
  year: text("year").notNull().default(""),
  title: text("title").notNull().default(""),
  containerTitle: text("container_title").notNull().default(""),
  publisher: text("publisher").notNull().default(""),
  pages: text("pages").notNull().default(""),
  doi: text("doi").notNull().default(""),
  url: text("url").notNull().default(""),
  accessedAt: text("accessed_at").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transitionSources = pgTable(
  "transition_sources",
  {
    transitionId: uuid("transition_id").notNull().references(() => transitions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.transitionId, table.sourceId] })],
);

export const soundChangeSources = pgTable(
  "sound_change_sources",
  {
    soundChangeId: uuid("sound_change_id").notNull().references(() => soundChanges.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.soundChangeId, table.sourceId] })],
);

export const examples = pgTable(
  "examples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    soundChangeId: uuid("sound_change_id").notNull().references(() => soundChanges.id, { onDelete: "cascade" }),
    sourceForm: text("source_form").notNull(),
    targetForm: text("target_form").notNull(),
    sourceReconstructed: boolean("source_reconstructed").notNull().default(false),
    targetReconstructed: boolean("target_reconstructed").notNull().default(false),
    gloss: text("gloss").notNull().default(""),
    notes: text("notes").notNull().default(""),
    sourceWiktionaryUrl: text("source_wiktionary_url").notNull().default(""),
    targetWiktionaryUrl: text("target_wiktionary_url").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("examples_change_idx").on(table.soundChangeId, table.sortOrder)],
);

export const moderators = pgTable(
  "moderators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: moderatorRoleEnum("role").notNull().default("moderator"),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("moderators_username_idx").on(table.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moderatorId: uuid("moderator_id").notNull().references(() => moderators.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_hash_idx").on(table.tokenHash), index("sessions_expiry_idx").on(table.expiresAt)],
);

export const revisionEvents = pgTable(
  "revision_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moderatorId: uuid("moderator_id").references(() => moderators.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    contributorCredit: text("contributor_credit").notNull().default(""),
    beforeSnapshot: jsonb("before_snapshot"),
    afterSnapshot: jsonb("after_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("revision_events_created_idx").on(table.createdAt)],
);

export const catalogChanges = pgTable(
  "catalog_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moderatorId: uuid("moderator_id").references(() => moderators.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    revertsChangeId: uuid("reverts_change_id").references((): AnyPgColumn => catalogChanges.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("catalog_changes_created_idx").on(table.createdAt), index("catalog_changes_moderator_idx").on(table.moderatorId)],
);

export const catalogChangeItems = pgTable(
  "catalog_change_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    changeId: uuid("change_id").notNull().references(() => catalogChanges.id, { onDelete: "restrict" }),
    tableName: text("table_name").notNull(),
    rowKey: text("row_key").notNull(),
    beforeSnapshot: jsonb("before_snapshot"),
    afterSnapshot: jsonb("after_snapshot"),
  },
  (table) => [index("catalog_change_items_change_idx").on(table.changeId), index("catalog_change_items_entity_idx").on(table.tableName, table.rowKey)],
);

export const slugAliases = pgTable(
  "slug_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    oldSlug: text("old_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("slug_aliases_old_slug_idx").on(table.entityType, table.oldSlug)],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_expiry_idx").on(table.expiresAt)],
);

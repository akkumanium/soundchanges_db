import { z } from "zod";
import { exampleInputSchema, lineageInputSchema, ruleInputSchema, sourceInputSchema, transitionInputSchema } from "./domain";

const transitionMetadataSchema = transitionInputSchema.omit({ rule: true, source: true, example: true });
const versionedEntity = { id: z.string().uuid(), baseRevision: z.number().int().positive() };

export const createLineageOperationSchema = z.object({
  type: z.literal("create_lineage"),
  data: lineageInputSchema,
});

export const createTransitionOperationSchema = z.object({
  type: z.literal("create_transition"),
  data: transitionInputSchema,
});

const updateLineageOperationSchema = z.object({ type: z.literal("update_lineage"), ...versionedEntity, data: lineageInputSchema });
const deleteLineageOperationSchema = z.object({ type: z.literal("delete_lineage"), ...versionedEntity });
const updateTransitionOperationSchema = z.object({ type: z.literal("update_transition"), ...versionedEntity, data: transitionMetadataSchema });
const deleteTransitionOperationSchema = z.object({ type: z.literal("delete_transition"), ...versionedEntity });
const createRuleOperationSchema = z.object({ type: z.literal("create_rule"), transitionId: z.string().uuid(), data: ruleInputSchema });
const updateRuleOperationSchema = z.object({ type: z.literal("update_rule"), ...versionedEntity, data: ruleInputSchema });
const deleteRuleOperationSchema = z.object({ type: z.literal("delete_rule"), ...versionedEntity });
const createExampleOperationSchema = z.object({ type: z.literal("create_example"), soundChangeId: z.string().uuid(), data: exampleInputSchema });
const updateExampleOperationSchema = z.object({ type: z.literal("update_example"), ...versionedEntity, data: exampleInputSchema });
const deleteExampleOperationSchema = z.object({ type: z.literal("delete_example"), ...versionedEntity });
const createSourceOperationSchema = z.object({ type: z.literal("create_source"), targetType: z.enum(["transition", "rule"]), targetId: z.string().uuid(), data: sourceInputSchema.refine((data) => data.displayCitation.length > 0, "A citation is required.") });

export const editorialRequestOperationSchema = z.object({
  type: z.literal("editorial_request"),
  entityType: z.enum(["lineage", "transition", "rule", "example", "source", "other"]),
  entityId: z.string().uuid().or(z.literal("")),
  requestedChange: z.string().trim().min(10).max(10000),
});

export const proposalOperationSchema = z.discriminatedUnion("type", [
  createLineageOperationSchema,
  updateLineageOperationSchema,
  deleteLineageOperationSchema,
  createTransitionOperationSchema,
  updateTransitionOperationSchema,
  deleteTransitionOperationSchema,
  createRuleOperationSchema,
  updateRuleOperationSchema,
  deleteRuleOperationSchema,
  createExampleOperationSchema,
  updateExampleOperationSchema,
  deleteExampleOperationSchema,
  createSourceOperationSchema,
  editorialRequestOperationSchema,
]);

export type ProposalOperation = z.infer<typeof proposalOperationSchema>;

export function parseOperations(value: unknown): ProposalOperation[] {
  return z.array(proposalOperationSchema).parse(value);
}

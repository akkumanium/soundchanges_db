import { z } from "zod";

export const nodeKinds = ["family", "subgroup", "stage", "language", "variety"] as const;
export const relationshipKinds = ["contains", "descends_from"] as const;

const plainText = (max: number) => z.string().trim().max(max).transform(normalizeUnicode);
const optionalUrl = z.string().trim().max(2048).refine(
  (value) => value === "" || /^https:\/\//i.test(value),
  "Use a complete HTTPS URL.",
);

export const lineageInputSchema = z.object({
  name: plainText(160).pipe(z.string().min(1, "Enter a name.")),
  slug: plainText(180).pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.")),
  kind: z.enum(nodeKinds),
  parentId: z.string().uuid().or(z.literal("")),
  relationshipKind: z.enum(relationshipKinds),
  description: plainText(4000),
});

export const ruleInputSchema = z.object({
  input: plainText(200),
  output: plainText(200),
  environment: plainText(300),
  exceptions: plainText(500),
  qualifier: plainText(200),
  explanation: plainText(2000),
  displayNotation: plainText(800).pipe(z.string().min(1, "Enter or generate the displayed rule.")),
});

export const sourceInputSchema = z.object({
  displayCitation: plainText(2000),
  url: optionalUrl,
  doi: plainText(300),
});

export const exampleInputSchema = z.object({
  sourceForm: plainText(300).pipe(z.string().min(1)),
  targetForm: plainText(300).pipe(z.string().min(1)),
  gloss: plainText(500),
  notes: plainText(1000),
  sourceReconstructed: z.boolean().default(false),
  targetReconstructed: z.boolean().default(false),
  sourceWiktionaryUrl: wiktionaryUrlSchema(),
  targetWiktionaryUrl: wiktionaryUrlSchema(),
});

export const transitionInputSchema = z.object({
  title: plainText(240).pipe(z.string().min(1, "Enter a title.")),
  slug: plainText(260).pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  chronology: plainText(500),
  summary: plainText(3000),
  notes: plainText(5000),
  rule: ruleInputSchema,
  source: sourceInputSchema.optional(),
  example: exampleInputSchema.optional(),
});

export function normalizeUnicode(value: string): string {
  return value.normalize("NFC");
}

export function composeRule(input: string, output: string, environment = "", qualifier = "", exceptions = ""): string {
  const core = `${normalizeUnicode(input.trim())} > ${normalizeUnicode(output.trim())}`;
  const conditioned = environment.trim() ? `${core} / ${normalizeUnicode(environment.trim())}` : core;
  const excepted = exceptions.trim() ? `${conditioned} / ! ${normalizeUnicode(exceptions.trim())}` : conditioned;
  return qualifier.trim() ? `${excepted} (${normalizeUnicode(qualifier.trim())})` : excepted;
}

export function isWiktionaryUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "wiktionary.org" || url.hostname.endsWith(".wiktionary.org"));
  } catch {
    return false;
  }
}

function wiktionaryUrlSchema() {
  return z.string().trim().max(2048).refine(isWiktionaryUrl, "Use an HTTPS Wiktionary URL.");
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

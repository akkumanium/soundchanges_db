import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { lineageNodes, soundChanges, transitions } from "../src/db/schema";

async function main() {
  const existing = await db.select({ id: lineageNodes.id }).from(lineageNodes).where(eq(lineageNodes.isDemo, true)).limit(1);
  if (existing.length) { await sql.end(); return; }
  await db.transaction(async (tx) => {
    const [afroAsiatic] = await tx.insert(lineageNodes).values({ name: "Afro-Asiatic", slug: "afro-asiatic", kind: "family", isDemo: true }).returning();
    const [paa] = await tx.insert(lineageNodes).values({ name: "Proto-Afro-Asiatic", slug: "proto-afro-asiatic", kind: "stage", parentId: afroAsiatic.id, isDemo: true }).returning();
    const [pomotic] = await tx.insert(lineageNodes).values({ name: "Proto-Omotic", slug: "proto-omotic", kind: "stage", parentId: paa.id, relationshipKind: "descends_from", isDemo: true }).returning();
    const [northOmotic] = await tx.insert(lineageNodes).values({ name: "North Omotic", slug: "north-omotic", kind: "subgroup", parentId: pomotic.id, relationshipKind: "descends_from", isDemo: true }).returning();
    const [indoEuropean] = await tx.insert(lineageNodes).values({ name: "Indo-European", slug: "indo-european", kind: "family", sortOrder: 1, isDemo: true }).returning();
    const [protoSlavic] = await tx.insert(lineageNodes).values({ name: "Proto-Slavic", slug: "proto-slavic", kind: "stage", parentId: indoEuropean.id, isDemo: true }).returning();
    const [russian] = await tx.insert(lineageNodes).values({ name: "Russian", slug: "russian", kind: "language", parentId: protoSlavic.id, relationshipKind: "descends_from", isDemo: true }).returning();
    const [omotic] = await tx.insert(transitions).values({ sourceNodeId: paa.id, targetNodeId: pomotic.id, title: "Proto-Afro-Asiatic to Proto-Omotic", slug: "proto-afro-asiatic-to-proto-omotic", isDemo: true }).returning();
    await tx.insert(soundChanges).values([{ transitionId: omotic.id, input: "k", output: "tʃ", environment: "_ {i, e}", qualifier: "sporadically", displayNotation: "k > tʃ / _ {i, e} (sporadically)" }, { transitionId: omotic.id, input: "p", output: "f", environment: "V_V", displayNotation: "p > f / V_V" }]);
    const [north] = await tx.insert(transitions).values({ sourceNodeId: pomotic.id, targetNodeId: northOmotic.id, title: "Proto-Omotic to North Omotic", slug: "proto-omotic-to-north-omotic", isDemo: true }).returning();
    await tx.insert(soundChanges).values({ transitionId: north.id, input: "a", output: "ə", environment: "_#", qualifier: "often", displayNotation: "a > ə / _# (often)" });
    const [slavic] = await tx.insert(transitions).values({ sourceNodeId: protoSlavic.id, targetNodeId: russian.id, title: "Proto-Slavic to Russian", slug: "proto-slavic-to-russian", isDemo: true }).returning();
    await tx.insert(soundChanges).values({ transitionId: slavic.id, input: "V₁", output: "V₂", environment: "C_V₂", displayNotation: "V₁ > V₂ / C_V₂" });
  });
  await sql.end();
}
main().catch(async (error) => { console.error(error); await sql.end(); process.exitCode = 1; });

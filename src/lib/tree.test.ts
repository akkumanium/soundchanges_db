import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "./tree";

const nodes = [
  { id: "family", parentId: null },
  { id: "stage", parentId: "family" },
  { id: "language", parentId: "stage" },
];

describe("strict lineage tree", () => {
  it("rejects self-parenting", () => expect(wouldCreateCycle(nodes, "stage", "stage")).toBe(true));
  it("rejects moving a node beneath its descendant", () => expect(wouldCreateCycle(nodes, "family", "language")).toBe(true));
  it("allows a valid move", () => expect(wouldCreateCycle(nodes, "language", "family")).toBe(false));
});

import { describe, expect, it } from "vitest";
import { bypassedTransitionIds, wouldCreateCycle } from "./tree";

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

describe("intermediate transition migration", () => {
  it("selects an obsolete ancestor-to-target transition", () => {
    const oghuzNodes = [
      { id: "common-turkic", parentId: null },
      { id: "oghuz", parentId: "common-turkic" },
      { id: "turkish", parentId: "oghuz" },
    ];
    const transitions = [
      { id: "old", sourceNodeId: "common-turkic", targetNodeId: "turkish" },
      { id: "destination", sourceNodeId: "oghuz", targetNodeId: "turkish" },
      { id: "other", sourceNodeId: "common-turkic", targetNodeId: "oghuz" },
    ];

    expect(bypassedTransitionIds(oghuzNodes, transitions, "oghuz", "turkish", "destination")).toEqual(["old"]);
  });

  it("does not move rules from sibling or descendant entries", () => {
    const transitions = [
      { id: "destination", sourceNodeId: "middle", targetNodeId: "target" },
      { id: "sibling", sourceNodeId: "sibling", targetNodeId: "target" },
      { id: "descendant", sourceNodeId: "target", targetNodeId: "leaf" },
    ];

    expect(bypassedTransitionIds(
      [{ id: "root", parentId: null }, { id: "middle", parentId: "root" }, { id: "target", parentId: "middle" }, { id: "sibling", parentId: "root" }, { id: "leaf", parentId: "target" }],
      transitions,
      "middle",
      "target",
      "destination",
    )).toEqual([]);
  });
});

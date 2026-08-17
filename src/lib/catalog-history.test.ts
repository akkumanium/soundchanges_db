import { describe, expect, it } from "vitest";
import { buildHistoryReferences, changedHistoryFields, describeHistoryItem, type HistoryItem } from "./catalog-history";

const emptyCatalog = { nodes: [], transitions: [] };

describe("catalog history presentation", () => {
  it("uses language names from audit snapshots for deleted pairs", () => {
    const nodeItems: HistoryItem[] = [
      { tableName: "lineage_nodes", rowKey: "old", beforeSnapshot: { id: "old", name: "Old English" }, afterSnapshot: null },
      { tableName: "lineage_nodes", rowKey: "middle", beforeSnapshot: { id: "middle", name: "Middle English" }, afterSnapshot: null },
    ];
    const pair: HistoryItem = {
      tableName: "transitions", rowKey: "pair", beforeSnapshot: { id: "pair", sourceNodeId: "old", targetNodeId: "middle", title: "English" }, afterSnapshot: null,
    };
    const changes = [{ items: [...nodeItems, pair] }];
    const references = buildHistoryReferences(changes, emptyCatalog);

    expect(describeHistoryItem(pair, references)).toBe("Language pair: Old English → Middle English");
    expect(changedHistoryFields(pair, references)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Source language", before: "Old English" }),
      expect.objectContaining({ label: "Target language", before: "Middle English" }),
    ]));
  });

  it("shows a sound change with its language-pair context", () => {
    const items: HistoryItem[] = [
      { tableName: "lineage_nodes", rowKey: "a", beforeSnapshot: null, afterSnapshot: { id: "a", name: "Latin" } },
      { tableName: "lineage_nodes", rowKey: "b", beforeSnapshot: null, afterSnapshot: { id: "b", name: "French" } },
      { tableName: "transitions", rowKey: "pair", beforeSnapshot: null, afterSnapshot: { id: "pair", sourceNodeId: "a", targetNodeId: "b" } },
      { tableName: "sound_changes", rowKey: "rule", beforeSnapshot: { displayNotation: "p → b" }, afterSnapshot: { displayNotation: "p → v", transitionId: "pair" } },
    ];
    const references = buildHistoryReferences([{ items }], emptyCatalog);

    expect(describeHistoryItem(items[3], references)).toBe("Sound change: p → v in Latin → French");
  });
});

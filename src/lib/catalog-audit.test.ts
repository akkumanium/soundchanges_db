import { describe, expect, it } from "vitest";
import { sameSnapshot, snapshotDeltaFromDatabase, snapshotFromDatabase } from "./catalog-audit";

describe("catalog audit snapshots", () => {
  it("treats database dates and their JSON representation as equal", () => {
    expect(sameSnapshot({ id: "x", updatedAt: new Date("2026-08-15T00:00:00Z") }, { updatedAt: "2026-08-15T00:00:00.000Z", id: "x" })).toBe(true);
  });

  it("detects a changed field", () => {
    expect(sameSnapshot({ id: "x", name: "Old" }, { id: "x", name: "New" })).toBe(false);
  });

  it("converts database column names to the existing snapshot format", () => {
    expect(snapshotFromDatabase({ id: "x", transition_id: "pair", updated_at: "2026-08-15T00:00:00Z" })).toEqual({
      id: "x",
      transitionId: "pair",
      updatedAt: new Date("2026-08-15T00:00:00Z"),
    });
  });

  it("stores only changed fields for updates", () => {
    expect(snapshotDeltaFromDatabase({
      tableName: "transitions",
      rowKey: "x",
      beforeSnapshot: { id: "x", title: "Old", revision: 1, updated_at: "2026-08-15T00:00:00Z" },
      afterSnapshot: { id: "x", title: "New", revision: 2, updated_at: "2026-08-16T00:00:00Z" },
    })).toEqual({
      tableName: "transitions",
      rowKey: "x",
      beforeSnapshot: { title: "Old", revision: 1, updatedAt: new Date("2026-08-15T00:00:00Z") },
      afterSnapshot: { title: "New", revision: 2, updatedAt: new Date("2026-08-16T00:00:00Z") },
    });
  });
});

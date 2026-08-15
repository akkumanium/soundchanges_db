import { describe, expect, it } from "vitest";
import { sameSnapshot } from "./catalog-audit";

describe("catalog audit snapshots", () => {
  it("treats database dates and their JSON representation as equal", () => {
    expect(sameSnapshot({ id: "x", updatedAt: new Date("2026-08-15T00:00:00Z") }, { updatedAt: "2026-08-15T00:00:00.000Z", id: "x" })).toBe(true);
  });

  it("detects a changed field", () => {
    expect(sameSnapshot({ id: "x", name: "Old" }, { id: "x", name: "New" })).toBe(false);
  });
});

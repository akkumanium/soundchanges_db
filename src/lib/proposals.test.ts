import { describe, expect, it } from "vitest";
import { parseOperations } from "./proposals";

describe("proposal operations", () => {
  it("accepts a valid editorial request", () => {
    expect(parseOperations([{ type: "editorial_request", entityType: "rule", entityId: "", requestedChange: "Correct the environment and add the cited source." }])).toHaveLength(1);
  });

  it("rejects executable or unknown operation types", () => {
    expect(() => parseOperations([{ type: "run_sql", statement: "drop table" }])).toThrow();
  });
});

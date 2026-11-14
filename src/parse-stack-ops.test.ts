import { describe, expect, it } from "vitest";
import { parseStackOperations } from "./parse-stack-ops.ts";

describe("parseStackOperations", () => {
  it("accepts commas, newlines, and a blank list", () => {
    expect(parseStackOperations("push 4, push 9, peek, pop")).toEqual([
      { op: "push", value: 4 },
      { op: "push", value: 9 },
      { op: "peek" },
      { op: "pop" },
    ]);
    expect(parseStackOperations("PUSH -2\nPeek\npop")).toEqual([
      { op: "push", value: -2 },
      { op: "peek" },
      { op: "pop" },
    ]);
    expect(parseStackOperations("")).toEqual([]);
    expect(parseStackOperations("  ")).toEqual([]);
    expect(parseStackOperations("push +4, push 0.5")).toEqual([
      { op: "push", value: 4 },
      { op: "push", value: 0.5 },
    ]);
  });

  it("rejects operations it cannot read", () => {
    expect(() => parseStackOperations("shift")).toThrow(/shift/);
    expect(() => parseStackOperations("push")).toThrow(/push/);
    expect(() => parseStackOperations("push 1 2")).toThrow(/push 1 2/);
    expect(() => parseStackOperations("pop 1")).toThrow(/pop 1/);
    expect(() => parseStackOperations("push Infinity")).toThrow(/finite/);
    expect(() => parseStackOperations("push nope")).toThrow(/nope/);
  });
});

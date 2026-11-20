import { describe, expect, it } from "vitest";
import { parseHeapOperations } from "./parse-heap-ops.ts";

describe("parseHeapOperations", () => {
  it("accepts commas, newlines, and a blank list", () => {
    expect(parseHeapOperations("insert 5, extract-min, peek")).toEqual([
      { op: "insert", value: 5 },
      { op: "extract-min" },
      { op: "peek" },
    ]);
    expect(parseHeapOperations("INSERT -2\nPeek\nextract-min")).toEqual([
      { op: "insert", value: -2 },
      { op: "peek" },
      { op: "extract-min" },
    ]);
    expect(parseHeapOperations("")).toEqual([]);
    expect(parseHeapOperations("  ")).toEqual([]);
    expect(parseHeapOperations("insert +4, insert 0.5")).toEqual([
      { op: "insert", value: 4 },
      { op: "insert", value: 0.5 },
    ]);
  });

  it("rejects operations it cannot read", () => {
    expect(() => parseHeapOperations("shift")).toThrow(/shift/);
    expect(() => parseHeapOperations("insert")).toThrow(/insert/);
    expect(() => parseHeapOperations("insert 1 2")).toThrow(/insert 1 2/);
    expect(() => parseHeapOperations("peek 1")).toThrow(/peek 1/);
    expect(() => parseHeapOperations("extract-min 1")).toThrow(/extract-min 1/);
    expect(() => parseHeapOperations("insert Infinity")).toThrow(/finite/);
    expect(() => parseHeapOperations("delete 4")).toThrow(/delete 4/);
    expect(() => parseHeapOperations("insert nope")).toThrow(/nope/);
  });
});

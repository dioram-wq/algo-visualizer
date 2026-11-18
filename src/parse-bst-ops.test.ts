import { describe, expect, it } from "vitest";
import { parseBstOperations } from "./parse-bst-ops.ts";

describe("parseBstOperations", () => {
  it("accepts commas, newlines, and a blank list", () => {
    expect(parseBstOperations("insert 8, search 3, insert 10")).toEqual([
      { op: "insert", value: 8 },
      { op: "search", value: 3 },
      { op: "insert", value: 10 },
    ]);
    expect(parseBstOperations("INSERT -2\nSearch 0\ninsert +1")).toEqual([
      { op: "insert", value: -2 },
      { op: "search", value: 0 },
      { op: "insert", value: 1 },
    ]);
    expect(parseBstOperations("")).toEqual([]);
    expect(parseBstOperations("  ")).toEqual([]);
    expect(parseBstOperations("insert +4, search 0.5")).toEqual([
      { op: "insert", value: 4 },
      { op: "search", value: 0.5 },
    ]);
  });

  it("rejects operations it cannot read", () => {
    expect(() => parseBstOperations("shift")).toThrow(/shift/);
    expect(() => parseBstOperations("insert")).toThrow(/insert/);
    expect(() => parseBstOperations("insert 1 2")).toThrow(/insert 1 2/);
    expect(() => parseBstOperations("search")).toThrow(/search/);
    expect(() => parseBstOperations("search Infinity")).toThrow(/finite/);
    expect(() => parseBstOperations("delete 4")).toThrow(/delete 4/);
    expect(() => parseBstOperations("search nope")).toThrow(/nope/);
  });
});

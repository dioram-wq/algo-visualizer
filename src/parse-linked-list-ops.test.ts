import { describe, expect, it } from "vitest";
import { parseLinkedListOperations } from "./parse-linked-list-ops.ts";

describe("parseLinkedListOperations", () => {
  it("accepts commas, newlines, and a blank list", () => {
    expect(
      parseLinkedListOperations("insert-head 4, insert-tail 9, search 4, delete 9"),
    ).toEqual([
      { op: "insert-head", value: 4 },
      { op: "insert-tail", value: 9 },
      { op: "search", value: 4 },
      { op: "delete", value: 9 },
    ]);
    expect(parseLinkedListOperations("INSERT-HEAD -2\nSearch 0\ndelete +1")).toEqual([
      { op: "insert-head", value: -2 },
      { op: "search", value: 0 },
      { op: "delete", value: 1 },
    ]);
    expect(parseLinkedListOperations("")).toEqual([]);
    expect(parseLinkedListOperations("  ")).toEqual([]);
    expect(parseLinkedListOperations("insert-tail +4, insert-head 0.5")).toEqual([
      { op: "insert-tail", value: 4 },
      { op: "insert-head", value: 0.5 },
    ]);
  });

  it("rejects operations it cannot read", () => {
    expect(() => parseLinkedListOperations("shift")).toThrow(/shift/);
    expect(() => parseLinkedListOperations("insert-head")).toThrow(/insert-head/);
    expect(() => parseLinkedListOperations("insert-tail 1 2")).toThrow(/insert-tail 1 2/);
    expect(() => parseLinkedListOperations("delete")).toThrow(/delete/);
    expect(() => parseLinkedListOperations("search Infinity")).toThrow(/finite/);
    expect(() => parseLinkedListOperations("search nope")).toThrow(/nope/);
  });
});

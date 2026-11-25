import { describe, expect, it } from "vitest";
import { codeLine, highlightedLine, type CodeListing } from "../code-panel.ts";
import {
  BINARY_SEARCH_CODE,
  binarySearchSteps,
  type BinarySearchComparison,
} from "./binary-search.ts";
import {
  INSERTION_SORT_CODE,
  insertionSortSteps,
  type InsertionSortAction,
} from "./insertion-sort.ts";

const BINARY_SEARCH_TEXT: Record<BinarySearchComparison, string> = {
  init: "low <- 0, high <- n - 1",
  equal: "    if a[mid] = target then return mid",
  less: "    if a[mid] < target then low <- mid + 1",
  greater: "    else high <- mid - 1",
  absent: "return not found",
};

const INSERTION_SORT_TEXT: Record<InsertionSortAction, string> = {
  start: "for i <- 1 to n - 1",
  compare: "    while j > 0 and a[j - 1] > a[j]",
  swap: "        swap a[j - 1] and a[j]",
  done: "the array is sorted",
};

function expectLine(listing: CodeListing, line: number, text: string) {
  expect(listing.lines[line]).toBe(text);
  expect(line).toBe(codeLine(listing, line));
  expect(highlightedLine(listing, line)).toBe(line);
}

describe("binary search step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...BINARY_SEARCH_CODE.lines]).toEqual([
      "low <- 0, high <- n - 1",
      "while low <= high",
      "    mid <- floor((low + high) / 2)",
      "    if a[mid] = target then return mid",
      "    if a[mid] < target then low <- mid + 1",
      "    else high <- mid - 1",
      "return not found",
    ]);
  });

  it("points a miss at setup, the high branch, the low branch, then not found", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 3);
    expect(steps.map((step) => step.comparison)).toEqual(["init", "greater", "less", "absent"]);
    for (const step of steps) {
      expectLine(BINARY_SEARCH_CODE, step.line, BINARY_SEARCH_TEXT[step.comparison]);
    }
  });

  it("points a match at the return line", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 16);
    const found = steps.find((step) => step.comparison === "equal");
    expect(found).toBeDefined();
    expectLine(BINARY_SEARCH_CODE, found?.line ?? -1, BINARY_SEARCH_TEXT.equal);
  });

  it("points an empty array at not found", () => {
    const steps = binarySearchSteps([], 4);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.comparison).toBe("absent");
    expectLine(BINARY_SEARCH_CODE, steps[0]?.line ?? -1, BINARY_SEARCH_TEXT.absent);
  });

  it("keeps every probe inside the listing", () => {
    const values = [2, 5, 8, 12, 16, 23, 38, 56];
    for (const target of [-1, 2, 12, 23, 56, 90]) {
      const steps = binarySearchSteps(values, target);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(BINARY_SEARCH_CODE, step.line, BINARY_SEARCH_TEXT[step.comparison]);
      }
    }
  });
});

describe("insertion sort step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...INSERTION_SORT_CODE.lines]).toEqual([
      "for i <- 1 to n - 1",
      "    j <- i",
      "    while j > 0 and a[j - 1] > a[j]",
      "        swap a[j - 1] and a[j]",
      "        j <- j - 1",
      "the array is sorted",
    ]);
  });

  it("points start, each comparison, each swap, and the finish at their lines", () => {
    const steps = insertionSortSteps([3, 1, 2]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "compare",
      "swap",
      "compare",
      "swap",
      "compare",
      "done",
    ]);
    const ordered = steps.filter((step) => step.action === "compare" && step.outOfOrder === false);
    const swapped = steps.filter((step) => step.action === "compare" && step.outOfOrder === true);
    expect(ordered.length).toBeGreaterThan(0);
    expect(swapped.length).toBeGreaterThan(0);
    for (const step of steps) {
      expectLine(INSERTION_SORT_CODE, step.line, INSERTION_SORT_TEXT[step.action]);
    }
  });

  it("points an empty array and a single value at the finished line", () => {
    for (const input of [[], [7]]) {
      const steps = insertionSortSteps(input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("done");
      expectLine(INSERTION_SORT_CODE, steps[0]?.line ?? -1, INSERTION_SORT_TEXT.done);
    }
  });

  it("keeps every action inside the listing", () => {
    const samples = [[], [1], [1, 2, 3, 4], [3, 2, 1], [5, 2, 4, 6, 1, 3], [2, 2, 1]];
    for (const input of samples) {
      const steps = insertionSortSteps(input);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(INSERTION_SORT_CODE, step.line, INSERTION_SORT_TEXT[step.action]);
      }
    }
  });
});

describe("highlighted line", () => {
  it("marks an in-range index and ignores an empty or invalid one", () => {
    const listing = BINARY_SEARCH_CODE;
    expect(highlightedLine(listing, null)).toBeNull();
    expect(highlightedLine(listing, 0)).toBe(0);
    expect(highlightedLine(listing, listing.lines.length - 1)).toBe(listing.lines.length - 1);
    expect(highlightedLine(listing, -1)).toBeNull();
    expect(highlightedLine(listing, listing.lines.length)).toBeNull();
    expect(highlightedLine(listing, 1.5)).toBeNull();
    expect(highlightedLine(listing, Number.NaN)).toBeNull();
  });

  it("rejects a line outside the listing", () => {
    expect(() => codeLine(BINARY_SEARCH_CODE, -1)).toThrow(RangeError);
    expect(() => codeLine(BINARY_SEARCH_CODE, BINARY_SEARCH_CODE.lines.length)).toThrow(RangeError);
    expect(() => codeLine(INSERTION_SORT_CODE, 1.5)).toThrow(RangeError);
  });
});

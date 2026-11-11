import { describe, expect, it } from "vitest";
import { insertionSortSteps, type InsertionSortStep } from "./insertion-sort.ts";

function outline(steps: readonly InsertionSortStep[]) {
  return steps.map((step) => ({
    action: step.action,
    values: [...step.values],
    sortedPrefix: step.sortedPrefix,
    keyIndex: step.keyIndex,
    left: step.left,
    right: step.right,
    outOfOrder: step.outOfOrder,
    message: step.message,
  }));
}

function sortedCopy(values: readonly number[]): number[] {
  return values.slice().sort((left, right) => left - right);
}

function isNonDecreasing(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || current < previous) return false;
  }
  return true;
}

function countsOf(values: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/** The prefix is sorted once the moving value is in place, and stays a permutation throughout. */
function expectSortedPrefixInvariant(input: readonly number[], steps: readonly InsertionSortStep[]) {
  expect(steps.length).toBeGreaterThan(0);
  expect(steps[0]?.values).toEqual(input);
  expect(steps.at(-1)?.action).toBe("done");
  expect(steps.at(-1)?.values).toEqual(sortedCopy(input));
  expect(steps.at(-1)?.sortedPrefix).toBe(input.length);
  expect(steps.at(-1)?.keyIndex).toBeNull();

  if (input.length <= 1) {
    expect(steps).toHaveLength(1);
  } else {
    expect(steps[0]?.action).toBe("start");
    expect(steps[0]?.sortedPrefix).toBe(1);
  }

  const original = countsOf(input);
  let previousPrefix = steps[0]?.sortedPrefix ?? 0;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step) continue;
    expect(countsOf(step.values)).toEqual(original);
    expect(Object.isFrozen(step.values)).toBe(true);
    expect(step.sortedPrefix).toBeGreaterThanOrEqual(0);
    expect(step.sortedPrefix).toBeLessThanOrEqual(input.length);
    expect(step.sortedPrefix).toBeGreaterThanOrEqual(previousPrefix);
    expect(step.sortedPrefix - previousPrefix).toBeLessThanOrEqual(1);
    previousPrefix = step.sortedPrefix;

    if (step.keyIndex === null) {
      expect(isNonDecreasing(step.values.slice(0, step.sortedPrefix))).toBe(true);
    } else {
      expect(step.keyIndex).toBeGreaterThanOrEqual(0);
      expect(step.keyIndex).toBeLessThan(step.sortedPrefix);
      const withoutKey = step.values.filter((_, valueIndex) => valueIndex !== step.keyIndex);
      expect(isNonDecreasing(withoutKey.slice(0, step.sortedPrefix - 1))).toBe(true);
      for (let right = step.keyIndex + 1; right < step.sortedPrefix; right += 1) {
        expect(step.values[right]).toBeGreaterThanOrEqual(step.values[step.keyIndex] ?? Number.NaN);
      }
    }

    if (step.action === "compare" || step.action === "swap") {
      expect(step.right).toBe((step.left ?? -1) + 1);
    } else {
      expect(step.left).toBeNull();
      expect(step.right).toBeNull();
      expect(step.outOfOrder).toBeNull();
    }

    if (step.action === "compare") {
      expect(step.outOfOrder).toBe((step.values[step.left ?? -1] ?? 0) > (step.values[step.right ?? -1] ?? 0));
      expect(step.values).toBe(steps[index - 1]?.values);
      if (step.outOfOrder) {
        expect(step.keyIndex).toBe(step.right);
        expect(steps[index + 1]?.action).toBe("swap");
      } else {
        expect(step.keyIndex).toBeNull();
        expect(steps[index + 1]?.action).not.toBe("swap");
      }
    }

    if (step.action === "swap") {
      const previous = steps[index - 1];
      expect(previous?.action).toBe("compare");
      expect(previous?.outOfOrder).toBe(true);
      expect(previous?.left).toBe(step.left);
      expect(previous?.right).toBe(step.right);
      const swapped = previous ? [...previous.values] : [];
      const left = step.left ?? 0;
      const right = step.right ?? 0;
      const held = swapped[left];
      swapped[left] = swapped[right] ?? 0;
      swapped[right] = held ?? 0;
      expect([...step.values]).toEqual(swapped);
      expect(step.values).not.toBe(previous?.values);
      if (step.keyIndex === null) expect(step.left).toBe(0);
      else expect(step.keyIndex).toBe(step.left);
    }
  }
}

describe("insertionSortSteps", () => {
  it("records the start, each comparison and swap, and a sorted ending", () => {
    expect(outline(insertionSortSteps([3, 1, 2]))).toEqual([
      {
        action: "start",
        values: [3, 1, 2],
        sortedPrefix: 1,
        keyIndex: null,
        left: null,
        right: null,
        outOfOrder: null,
        message: "Start with 3 values. Index 0 is a sorted prefix of one element.",
      },
      {
        action: "compare",
        values: [3, 1, 2],
        sortedPrefix: 2,
        keyIndex: 1,
        left: 0,
        right: 1,
        outOfOrder: true,
        message:
          "Index 0 holds 3, which is greater than 1 at index 1. Swap them so the smaller value moves left.",
      },
      {
        action: "swap",
        values: [1, 3, 2],
        sortedPrefix: 2,
        keyIndex: null,
        left: 0,
        right: 1,
        outOfOrder: null,
        message:
          "Swap indices 0 and 1. 1 is now at the front, so the sorted prefix covers indices 0 through 1.",
      },
      {
        action: "compare",
        values: [1, 3, 2],
        sortedPrefix: 3,
        keyIndex: 2,
        left: 1,
        right: 2,
        outOfOrder: true,
        message:
          "Index 1 holds 3, which is greater than 2 at index 2. Swap them so the smaller value moves left.",
      },
      {
        action: "swap",
        values: [1, 2, 3],
        sortedPrefix: 3,
        keyIndex: 1,
        left: 1,
        right: 2,
        outOfOrder: null,
        message: "Swap indices 1 and 2. 2 moves left to index 1.",
      },
      {
        action: "compare",
        values: [1, 2, 3],
        sortedPrefix: 3,
        keyIndex: null,
        left: 0,
        right: 1,
        outOfOrder: false,
        message:
          "Index 0 holds 1, which is less than or equal to 2 at index 1. The sorted prefix now covers indices 0 through 2.",
      },
      {
        action: "done",
        values: [1, 2, 3],
        sortedPrefix: 3,
        keyIndex: null,
        left: null,
        right: null,
        outOfOrder: null,
        message: "Every element is in the sorted prefix. The array is sorted.",
      },
    ]);
  });

  it("reports an empty array in one step", () => {
    expect(outline(insertionSortSteps([]))).toEqual([
      {
        action: "done",
        values: [],
        sortedPrefix: 0,
        keyIndex: null,
        left: null,
        right: null,
        outOfOrder: null,
        message: "The array is empty, so it is already sorted.",
      },
    ]);
  });

  it("treats a single element as already sorted", () => {
    expect(outline(insertionSortSteps([7]))).toEqual([
      {
        action: "done",
        values: [7],
        sortedPrefix: 1,
        keyIndex: null,
        left: null,
        right: null,
        outOfOrder: null,
        message: "The only value is already a sorted prefix.",
      },
    ]);
  });

  it("does not swap an already sorted array", () => {
    const steps = insertionSortSteps([1, 2, 3, 4]);
    expect(steps.map((step) => step.action)).toEqual(["start", "compare", "compare", "compare", "done"]);
    expect(steps.some((step) => step.action === "swap")).toBe(false);
    expect(steps.map((step) => step.sortedPrefix)).toEqual([1, 2, 3, 4, 4]);
    expect(steps.at(-1)?.values).toEqual([1, 2, 3, 4]);
    expectSortedPrefixInvariant([1, 2, 3, 4], steps);
  });

  it("sorts a reversed array by adjacent swaps", () => {
    const input = [3, 2, 1];
    const steps = insertionSortSteps(input);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "compare",
      "swap",
      "compare",
      "swap",
      "compare",
      "swap",
      "done",
    ]);
    expect(steps.at(-1)?.values).toEqual([1, 2, 3]);
    expect(steps.filter((step) => step.action === "swap")).toHaveLength(3);
    expectSortedPrefixInvariant(input, steps);
  });

  it("keeps equal values in place until a smaller one passes them", () => {
    const input = [2, 2, 1, 2];
    const steps = insertionSortSteps(input);
    expect(steps.at(-1)?.values).toEqual([1, 2, 2, 2]);
    for (let index = 1; index < steps.length; index += 1) {
      const step = steps[index];
      const previous = steps[index - 1];
      if (step?.action !== "swap" || !previous) continue;
      const left = previous.values[step.left ?? -1];
      const right = previous.values[step.right ?? -1];
      expect(left).toBeGreaterThan(right ?? Number.NaN);
    }
    expectSortedPrefixInvariant(input, steps);
  });

  it("ends on a sorted copy and keeps the prefix invariant", () => {
    const samples = [
      [],
      [4],
      [1, 2, 3],
      [4, 3, 2, 1],
      [2, 2, 2],
      [5, 2, 4, 6, 1, 3],
      [0, -2, -2, 4, 1],
      [1.5, -0.5, 1.5],
    ];
    let seed = 17;
    for (let length = 0; length <= 8; length += 1) {
      samples.push(
        Array.from({ length }, () => {
          seed = (seed * 17 + 3) % 100;
          return (seed % 11) - 5;
        }),
      );
    }

    for (const input of samples) {
      const steps = insertionSortSteps(input);
      expect(steps.at(-1)?.values).toEqual(sortedCopy(input));
      expect(steps.at(-1)?.values).not.toBe(input);
      expectSortedPrefixInvariant(input, steps);
    }
  });

  it("copies the array and does not mutate the caller", () => {
    const input = Object.freeze([3, 1, 2]);
    const steps = insertionSortSteps(input);
    expect(steps[0]?.values).toEqual([3, 1, 2]);
    expect(steps[0]?.values).not.toBe(input);
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expect(steps[2]?.values).not.toBe(steps[0]?.values);
    for (const step of steps) {
      expect(() => {
        (step.values as number[])[0] = 9;
      }).toThrow(TypeError);
    }
    expect(input).toEqual([3, 1, 2]);
  });

  it("rejects non-finite input", () => {
    const nanInput = [1, Number.NaN];
    expect(() => insertionSortSteps(nanInput)).toThrow(/finite/);
    expect(nanInput).toEqual([1, Number.NaN]);
    expect(() => insertionSortSteps([Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => insertionSortSteps([0, Number.NEGATIVE_INFINITY])).toThrow(/finite/);
  });
});

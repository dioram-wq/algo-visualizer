import { describe, expect, it } from "vitest";
import { quickSortSteps, type QuickSortStep } from "./quicksort.ts";

function outline(steps: readonly QuickSortStep[]) {
  return steps.map((step) => ({
    action: step.action,
    values: [...step.values],
    low: step.low,
    high: step.high,
    pivot: step.pivot,
    left: step.left,
    right: step.right,
    lessOrEqual: step.lessOrEqual,
    message: step.message,
  }));
}

function sortedCopy(values: readonly number[]): number[] {
  return values.slice().sort((left, right) => left - right);
}

function countsOf(values: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function isQuiet(step: QuickSortStep): boolean {
  return (
    step.low === null &&
    step.high === null &&
    step.pivot === null &&
    step.left === null &&
    step.right === null &&
    step.lessOrEqual === null
  );
}

/**
 * Partitions follow Lomuto order: the last element is the pivot, each earlier
 * index is compared with it, smaller-or-equal values swap into the next open
 * slot, and the pivot swap (when the boundary is not already the end) is
 * followed by the pivot's final index. The left side is then partitioned,
 * then the right. Every arrangement stays a permutation of the input.
 */
function expectSensibleTrace(input: readonly number[], steps: readonly QuickSortStep[]) {
  expect(steps.length).toBeGreaterThan(0);
  expect(steps[0]?.values).toEqual(input);
  expect(steps[0]?.values).not.toBe(input);
  expect(steps.at(-1)?.action).toBe("done");
  expect(steps.at(-1)?.values).toEqual(sortedCopy(input));
  expect(isQuiet(steps.at(-1) as QuickSortStep)).toBe(true);

  const original = countsOf(input);
  if (input.length <= 1) {
    expect(steps).toHaveLength(1);
    expect(steps[0]?.action).toBe("done");
    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    return;
  }

  expect(steps[0]?.action).toBe("start");
  expect(isQuiet(steps[0] as QuickSortStep)).toBe(true);

  let cursor = 1;

  const consume = (low: number, high: number): void => {
    if (low >= high) return;
    const pivotIndex = consumePartition(low, high);
    consume(low, pivotIndex - 1);
    consume(pivotIndex + 1, high);
  };

  const consumePartition = (low: number, high: number): number => {
    const pivotStep = steps[cursor];
    const before = steps[cursor - 1];
    if (!pivotStep || !before) throw new Error("A partition is missing its pivot step.");
    expect(pivotStep.action).toBe("pivot");
    expect(pivotStep.low).toBe(low);
    expect(pivotStep.high).toBe(high);
    expect(pivotStep.pivot).toBe(high);
    expect(pivotStep.left).toBeNull();
    expect(pivotStep.right).toBeNull();
    expect(pivotStep.lessOrEqual).toBeNull();
    expect(pivotStep.values).toBe(before.values);
    expect(pivotStep.message.length).toBeGreaterThan(0);
    const pivotValue = pivotStep.values[high];
    if (pivotValue === undefined) throw new Error("A partition is missing its pivot.");
    cursor += 1;

    let store = low;
    for (let scan = low; scan < high; scan += 1) {
      const compare = steps[cursor];
      const previous = steps[cursor - 1];
      if (!compare || !previous) throw new Error("A comparison is missing.");
      expect(compare.action).toBe("compare");
      expect(compare.low).toBe(low);
      expect(compare.high).toBe(high);
      expect(compare.pivot).toBe(high);
      expect(compare.left).toBe(scan);
      expect(compare.right).toBe(high);
      expect(compare.values).toBe(previous.values);
      expect(compare.message.length).toBeGreaterThan(0);
      const scanValue = compare.values[scan];
      if (scanValue === undefined) throw new Error("A comparison is missing its value.");
      const lessOrEqual = scanValue <= pivotValue;
      expect(compare.lessOrEqual).toBe(lessOrEqual);
      expect(countsOf(compare.values)).toEqual(original);
      expect(Object.isFrozen(compare.values)).toBe(true);
      cursor += 1;

      if (!lessOrEqual) continue;
      if (store !== scan) {
        expectSwap(store, scan, high);
      }
      store += 1;
    }

    if (store !== high) {
      expectSwap(store, high, store);
    }

    const place = steps[cursor];
    const placedFrom = steps[cursor - 1];
    if (!place || !placedFrom) throw new Error("A partition is missing its place step.");
    expect(place.action).toBe("place");
    expect(place.low).toBe(low);
    expect(place.high).toBe(high);
    expect(place.pivot).toBe(store);
    expect(place.left).toBeNull();
    expect(place.right).toBeNull();
    expect(place.lessOrEqual).toBeNull();
    expect(place.values).toBe(placedFrom.values);
    expect(place.values[store]).toBe(pivotValue);
    expect(place.message.length).toBeGreaterThan(0);
    for (let index = low; index < store; index += 1) {
      expect(place.values[index]).toBeLessThanOrEqual(pivotValue);
    }
    for (let index = store + 1; index <= high; index += 1) {
      expect(place.values[index]).toBeGreaterThan(pivotValue);
    }
    expect(countsOf(place.values)).toEqual(original);
    expect(Object.isFrozen(place.values)).toBe(true);
    cursor += 1;
    return store;
  };

  const expectSwap = (left: number, right: number, pivot: number): void => {
    const swap = steps[cursor];
    const previous = steps[cursor - 1];
    if (!swap || !previous) throw new Error("A swap is missing.");
    expect(swap.action).toBe("swap");
    expect(swap.low).toBeGreaterThanOrEqual(0);
    expect(swap.high).toBe(previous.high);
    expect(swap.low).toBe(previous.low);
    expect(swap.pivot).toBe(pivot);
    expect(swap.left).toBe(left);
    expect(swap.right).toBe(right);
    expect(swap.lessOrEqual).toBeNull();
    expect(left).toBeLessThan(right);
    const exchanged = [...previous.values];
    const held = exchanged[left];
    exchanged[left] = exchanged[right] ?? 0;
    exchanged[right] = held ?? 0;
    expect([...swap.values]).toEqual(exchanged);
    expect(swap.values).not.toBe(previous.values);
    expect(swap.message.length).toBeGreaterThan(0);
    expect(countsOf(swap.values)).toEqual(original);
    expect(Object.isFrozen(swap.values)).toBe(true);
    cursor += 1;
  };

  consume(0, input.length - 1);
  expect(steps[cursor]?.action).toBe("done");
  expect(cursor).toBe(steps.length - 1);
  expect(countsOf(steps[cursor]?.values ?? [])).toEqual(original);
  expect(Object.isFrozen(steps[cursor]?.values)).toBe(true);
}

describe("quickSortSteps", () => {
  it("records the start, each pivot, comparison, and swap, and a sorted ending", () => {
    expect(outline(quickSortSteps([3, 1, 2]))).toEqual([
      {
        action: "start",
        values: [3, 1, 2],
        low: null,
        high: null,
        pivot: null,
        left: null,
        right: null,
        lessOrEqual: null,
        message:
          "Start with 3 values. Each partition uses the last element of the active range as the pivot.",
      },
      {
        action: "pivot",
        values: [3, 1, 2],
        low: 0,
        high: 2,
        pivot: 2,
        left: null,
        right: null,
        lessOrEqual: null,
        message: "Choose 2 at index 2 as the pivot for indices 0 through 2.",
      },
      {
        action: "compare",
        values: [3, 1, 2],
        low: 0,
        high: 2,
        pivot: 2,
        left: 0,
        right: 2,
        lessOrEqual: false,
        message:
          "Index 0 holds 3, which is greater than the pivot 2 at index 2. It stays on the right.",
      },
      {
        action: "compare",
        values: [3, 1, 2],
        low: 0,
        high: 2,
        pivot: 2,
        left: 1,
        right: 2,
        lessOrEqual: true,
        message:
          "Index 1 holds 1, which is less than or equal to the pivot 2 at index 2. It belongs on the left.",
      },
      {
        action: "swap",
        values: [1, 3, 2],
        low: 0,
        high: 2,
        pivot: 2,
        left: 0,
        right: 1,
        lessOrEqual: null,
        message: "Swap indices 0 and 1.",
      },
      {
        action: "swap",
        values: [1, 2, 3],
        low: 0,
        high: 2,
        pivot: 1,
        left: 1,
        right: 2,
        lessOrEqual: null,
        message: "Swap indices 1 and 2. The pivot moves to index 1.",
      },
      {
        action: "place",
        values: [1, 2, 3],
        low: 0,
        high: 2,
        pivot: 1,
        left: null,
        right: null,
        lessOrEqual: null,
        message:
          "2 is now at index 1, its final position. Index 0 is less than or equal to it. Index 2 is greater than it.",
      },
      {
        action: "done",
        values: [1, 2, 3],
        low: null,
        high: null,
        pivot: null,
        left: null,
        right: null,
        lessOrEqual: null,
        message: "Every pivot is in its final position. The array is sorted.",
      },
    ]);
  });

  it("reports an empty array in one step", () => {
    expect(outline(quickSortSteps([]))).toEqual([
      {
        action: "done",
        values: [],
        low: null,
        high: null,
        pivot: null,
        left: null,
        right: null,
        lessOrEqual: null,
        message: "The array is empty, so it is already sorted.",
      },
    ]);
  });

  it("treats a single element as already sorted", () => {
    expect(outline(quickSortSteps([7]))).toEqual([
      {
        action: "done",
        values: [7],
        low: null,
        high: null,
        pivot: null,
        left: null,
        right: null,
        lessOrEqual: null,
        message: "The only value is already sorted.",
      },
    ]);
  });

  it("does not swap an already sorted array", () => {
    const input = [1, 2, 3, 4];
    const steps = quickSortSteps(input);
    expect(steps.some((step) => step.action === "swap")).toBe(false);
    expect(steps.filter((step) => step.action === "compare").every((step) => step.lessOrEqual)).toBe(
      true,
    );
    expect(steps.every((step) => [...step.values].every((value, index) => value === input[index]))).toBe(
      true,
    );
    expect(new Set(steps.map((step) => step.values)).size).toBe(1);
    expect(steps.at(-1)?.values).toEqual([1, 2, 3, 4]);
    expectSensibleTrace(input, steps);
  });

  it("sorts a reversed array", () => {
    const input = [3, 2, 1];
    const steps = quickSortSteps(input);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "pivot",
      "compare",
      "compare",
      "swap",
      "place",
      "pivot",
      "compare",
      "place",
      "done",
    ]);
    expect(steps.at(-1)?.values).toEqual([1, 2, 3]);
    expect(steps.filter((step) => step.action === "swap")).toHaveLength(1);
    expectSensibleTrace(input, steps);
  });

  it("keeps duplicate values and puts equals on the pivot's left", () => {
    const input = [2, 2, 1, 2];
    const steps = quickSortSteps(input);
    expect(steps.at(-1)?.values).toEqual([1, 2, 2, 2]);
    const ties = steps.filter(
      (step) =>
        step.action === "compare" &&
        step.left !== null &&
        step.right !== null &&
        step.values[step.left] === step.values[step.right],
    );
    expect(ties.length).toBeGreaterThan(0);
    expect(ties.every((step) => step.lessOrEqual)).toBe(true);
    expectSensibleTrace(input, steps);
  });

  it("sorts negatives without dropping duplicate values", () => {
    const input = [-1, -5, -1, 0];
    const steps = quickSortSteps(input);
    expect(steps.at(-1)?.values).toEqual([-5, -1, -1, 0]);
    expect(steps.at(-1)?.action).toBe("done");
    expectSensibleTrace(input, steps);
  });

  it("ends on a sorted copy that matches Array.prototype.sort", () => {
    const samples = [
      [],
      [4],
      [1, 2, 3],
      [4, 3, 2, 1],
      [2, 2, 2],
      [2, 2, 1, 2],
      [5, 2, 4, 6, 1, 3],
      [0, -2, -2, 4, 1],
      [-5, -1, -1, 0],
      [1.5, -0.5, 1.5],
      [3, 1, 2],
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
      const steps = quickSortSteps(input);
      const finished = steps.at(-1);
      expect(finished?.action).toBe("done");
      expect(finished?.values).toEqual(sortedCopy(input));
      expect(finished?.values).not.toBe(input);
      expect([... (finished?.values ?? [])].every((value, index, all) => index === 0 || value >= (all[index - 1] ?? value))).toBe(
        true,
      );
      expectSensibleTrace(input, steps);
    }
  });

  it("copies the array and does not mutate the caller", () => {
    const input = Object.freeze([3, 1, 2]);
    const steps = quickSortSteps(input);
    expect(steps[0]?.values).toEqual([3, 1, 2]);
    expect(steps[0]?.values).not.toBe(input);
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expect(steps[2]?.values).toBe(steps[0]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toEqual([1, 3, 2]);
    for (const step of steps) {
      expect(() => {
        (step.values as number[])[0] = 9;
      }).toThrow(TypeError);
    }
    expect(input).toEqual([3, 1, 2]);

    const empty: readonly number[] = Object.freeze([]);
    const single: readonly number[] = Object.freeze([4]);
    expect(quickSortSteps(empty)[0]?.values).not.toBe(empty);
    expect(quickSortSteps(single)[0]?.values).not.toBe(single);
    expect(empty).toEqual([]);
    expect(single).toEqual([4]);
  });

  it("rejects non-finite input", () => {
    const nanInput = [1, Number.NaN];
    expect(() => quickSortSteps(nanInput)).toThrow(/finite/);
    expect(nanInput).toEqual([1, Number.NaN]);
    expect(() => quickSortSteps([Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => quickSortSteps([0, Number.NEGATIVE_INFINITY])).toThrow(/finite/);
  });
});

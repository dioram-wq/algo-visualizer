import { describe, expect, it } from "vitest";
import { mergeSortSteps, type MergeSortStep } from "./merge-sort.ts";

function outline(steps: readonly MergeSortStep[]) {
  return steps.map((step) => ({
    action: step.action,
    values: [...step.values],
    low: step.low,
    high: step.high,
    mid: step.mid,
    left: step.left,
    right: step.right,
    taken: step.taken,
    writeIndex: step.writeIndex,
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

function isQuiet(step: MergeSortStep): boolean {
  return (
    step.low === null &&
    step.high === null &&
    step.mid === null &&
    step.left === null &&
    step.right === null &&
    step.taken === null &&
    step.writeIndex === null
  );
}

/**
 * Each split is followed by its left half, its right half, then the comparisons
 * and the left-to-right writes that merge those halves. Runs are sorted before
 * they are merged. The whole array stays a permutation except while a merged
 * run is being copied back one index at a time.
 */
function expectSensibleTrace(input: readonly number[], steps: readonly MergeSortStep[]) {
  expect(steps.length).toBeGreaterThan(0);
  expect(steps[0]?.values).toEqual(input);
  expect(steps[0]?.values).not.toBe(input);
  expect(steps.at(-1)?.action).toBe("done");
  expect(steps.at(-1)?.values).toEqual(sortedCopy(input));
  expect(isQuiet(steps.at(-1) as MergeSortStep)).toBe(true);

  const original = countsOf(input);
  if (input.length <= 1) {
    expect(steps).toHaveLength(1);
    expect(steps[0]?.action).toBe("done");
    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    return;
  }

  expect(steps[0]?.action).toBe("start");
  expect(isQuiet(steps[0] as MergeSortStep)).toBe(true);

  interface Frame {
    low: number;
    high: number;
    mid: number;
    phase: "left" | "right" | "compare" | "write";
    cursorLeft: number;
    cursorRight: number;
    chosen: number[];
    nextWrite: number;
    base: readonly number[] | null;
  }

  const stack: Frame[] = [];
  let openedRoot = false;

  const leftLength = (frame: Frame): number => frame.mid - frame.low + 1;
  const rightLength = (frame: Frame): number => frame.high - frame.mid;

  const advanceToWork = (frame: Frame): void => {
    if (frame.phase === "left") {
      if (leftLength(frame) > 1) return;
      frame.phase = "right";
    }
    if (frame.phase === "right") {
      if (rightLength(frame) > 1) return;
      frame.phase = "compare";
    }
  };

  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index];
    const previous = steps[index - 1];
    if (!step || !previous) throw new Error("Missing step.");

    expect(Object.isFrozen(step.values)).toBe(true);
    expect(step.message.length).toBeGreaterThan(0);
    if (step.action !== "write") {
      expect(countsOf(step.values)).toEqual(original);
    }

    if (step.action === "start") {
      throw new Error("Start is only the first step.");
    }

    if (step.action === "done") {
      expect(index).toBe(steps.length - 1);
      expect(stack).toEqual([]);
      expect(isQuiet(step)).toBe(true);
      continue;
    }

    if (step.action === "split") {
      expect(step.left).toBeNull();
      expect(step.right).toBeNull();
      expect(step.taken).toBeNull();
      expect(step.writeIndex).toBeNull();
      if (step.low === null || step.high === null || step.mid === null) {
        throw new Error("A split is missing its range.");
      }
      const { low, high, mid } = step;
      expect(mid).toBe(Math.floor((low + high) / 2));
      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThan(input.length);
      expect(mid).toBeGreaterThanOrEqual(low);
      expect(mid).toBeLessThan(high);
      expect(step.values).toBe(previous.values);

      if (stack.length === 0) {
        expect(openedRoot).toBe(false);
        openedRoot = true;
        expect(low).toBe(0);
        expect(high).toBe(input.length - 1);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent) throw new Error("Missing parent split.");
        advanceToWork(parent);
        if (parent.phase === "left") {
          expect(low).toBe(parent.low);
          expect(high).toBe(parent.mid);
          parent.phase = "right";
        } else if (parent.phase === "right") {
          expect(low).toBe(parent.mid + 1);
          expect(high).toBe(parent.high);
          parent.phase = "compare";
        } else {
          expect(parent.phase).toBe("left");
        }
      }

      stack.push({
        low,
        high,
        mid,
        phase: "left",
        cursorLeft: low,
        cursorRight: mid + 1,
        chosen: [],
        nextWrite: low,
        base: null,
      });
      continue;
    }

    if (step.action === "compare") {
      const frame = stack[stack.length - 1];
      if (!frame) throw new Error("A comparison has no open split.");
      advanceToWork(frame);
      expect(frame.phase).toBe("compare");
      expect(step.low).toBe(frame.low);
      expect(step.high).toBe(frame.high);
      expect(step.mid).toBe(frame.mid);
      expect(step.writeIndex).toBeNull();
      expect(step.left).toBe(frame.cursorLeft);
      expect(step.right).toBe(frame.cursorRight);
      expect(step.values).toBe(previous.values);
      if (frame.base === null) frame.base = step.values;
      else expect(step.values).toBe(frame.base);

      const leftValue = step.left === null ? undefined : step.values[step.left];
      const rightValue = step.right === null ? undefined : step.values[step.right];
      expect(leftValue).toBeTypeOf("number");
      expect(rightValue).toBeTypeOf("number");
      if (leftValue === undefined || rightValue === undefined || step.left === null || step.right === null) {
        throw new Error("A comparison is missing its pair.");
      }
      expect(step.left).toBeGreaterThanOrEqual(frame.low);
      expect(step.left).toBeLessThanOrEqual(frame.mid);
      expect(step.right).toBeGreaterThan(frame.mid);
      expect(step.right).toBeLessThanOrEqual(frame.high);
      if (leftValue <= rightValue) {
        expect(step.taken).toBe("left");
        frame.chosen.push(leftValue);
        frame.cursorLeft += 1;
      } else {
        expect(step.taken).toBe("right");
        frame.chosen.push(rightValue);
        frame.cursorRight += 1;
      }
      if (frame.cursorLeft > frame.mid || frame.cursorRight > frame.high) {
        frame.phase = "write";
      }
      continue;
    }

    if (step.action === "write") {
      const frame = stack[stack.length - 1];
      if (!frame) throw new Error("A write has no open split.");
      advanceToWork(frame);
      if (frame.phase === "compare") {
        expect(frame.cursorLeft > frame.mid || frame.cursorRight > frame.high).toBe(true);
        frame.phase = "write";
      }
      expect(frame.phase).toBe("write");
      expect(step.low).toBe(frame.low);
      expect(step.high).toBe(frame.high);
      expect(step.mid).toBe(frame.mid);
      expect(step.left).toBeNull();
      expect(step.right).toBeNull();
      expect(step.taken).toBeNull();
      expect(step.writeIndex).toBe(frame.nextWrite);
      if (step.writeIndex === null || frame.base === null) {
        throw new Error("A write is missing its merge.");
      }

      if (frame.nextWrite === frame.low) {
        const snapshot = frame.base;
        expect(isNonDecreasing(snapshot.slice(frame.low, frame.mid + 1))).toBe(true);
        expect(isNonDecreasing(snapshot.slice(frame.mid + 1, frame.high + 1))).toBe(true);
        frame.chosen.push(
          ...snapshot.slice(frame.cursorLeft, frame.mid + 1),
          ...snapshot.slice(frame.cursorRight, frame.high + 1),
        );
        expect(frame.chosen).toHaveLength(frame.high - frame.low + 1);
        expect(isNonDecreasing(frame.chosen)).toBe(true);
        expect(frame.chosen.slice().sort((left, right) => left - right)).toEqual(
          snapshot.slice(frame.low, frame.high + 1).sort((left, right) => left - right),
        );
      }

      const expectedValue = frame.chosen[step.writeIndex - frame.low];
      expect(step.values[step.writeIndex]).toBe(expectedValue);
      for (let valueIndex = 0; valueIndex < step.values.length; valueIndex += 1) {
        if (valueIndex === step.writeIndex) continue;
        expect(step.values[valueIndex]).toBe(previous.values[valueIndex]);
      }
      if (previous.values[step.writeIndex] === expectedValue) {
        expect(step.values).toBe(previous.values);
      } else {
        expect(step.values).not.toBe(previous.values);
      }
      if (step.writeIndex === frame.high) {
        expect(countsOf(step.values)).toEqual(original);
      }

      frame.nextWrite += 1;
      if (frame.nextWrite > frame.high) stack.pop();
      continue;
    }

    const unexpected: never = step.action;
    throw new Error(`Unexpected merge sort action: ${String(unexpected)}`);
  }

  expect(stack).toEqual([]);
  expect(openedRoot).toBe(true);
}

describe("mergeSortSteps", () => {
  it("records the start, each split, comparison, and write, and a sorted ending", () => {
    expect(outline(mergeSortSteps([3, 1, 2]))).toEqual([
      {
        action: "start",
        values: [3, 1, 2],
        low: null,
        high: null,
        mid: null,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message:
          "Start with 3 values. Split them into single elements, then merge the sorted halves.",
      },
      {
        action: "split",
        values: [3, 1, 2],
        low: 0,
        high: 2,
        mid: 1,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message:
          "Split indices 0 through 2 at index 1. The left half is indices 0 through 1, and the right half is index 2.",
      },
      {
        action: "split",
        values: [3, 1, 2],
        low: 0,
        high: 1,
        mid: 0,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message:
          "Split indices 0 through 1 at index 0. The left half is index 0, and the right half is index 1.",
      },
      {
        action: "compare",
        values: [3, 1, 2],
        low: 0,
        high: 1,
        mid: 0,
        left: 0,
        right: 1,
        taken: "right",
        writeIndex: null,
        message:
          "Index 0 holds 3, which is greater than 1 at index 1. Take the right value.",
      },
      {
        action: "write",
        values: [1, 1, 2],
        low: 0,
        high: 1,
        mid: 0,
        left: null,
        right: null,
        taken: null,
        writeIndex: 0,
        message: "Write 1 at index 0.",
      },
      {
        action: "write",
        values: [1, 3, 2],
        low: 0,
        high: 1,
        mid: 0,
        left: null,
        right: null,
        taken: null,
        writeIndex: 1,
        message: "Write 3 at index 1.",
      },
      {
        action: "compare",
        values: [1, 3, 2],
        low: 0,
        high: 2,
        mid: 1,
        left: 0,
        right: 2,
        taken: "left",
        writeIndex: null,
        message:
          "Index 0 holds 1, which is less than or equal to 2 at index 2. Take the left value.",
      },
      {
        action: "compare",
        values: [1, 3, 2],
        low: 0,
        high: 2,
        mid: 1,
        left: 1,
        right: 2,
        taken: "right",
        writeIndex: null,
        message:
          "Index 1 holds 3, which is greater than 2 at index 2. Take the right value.",
      },
      {
        action: "write",
        values: [1, 3, 2],
        low: 0,
        high: 2,
        mid: 1,
        left: null,
        right: null,
        taken: null,
        writeIndex: 0,
        message: "Write 1 at index 0.",
      },
      {
        action: "write",
        values: [1, 2, 2],
        low: 0,
        high: 2,
        mid: 1,
        left: null,
        right: null,
        taken: null,
        writeIndex: 1,
        message: "Write 2 at index 1.",
      },
      {
        action: "write",
        values: [1, 2, 3],
        low: 0,
        high: 2,
        mid: 1,
        left: null,
        right: null,
        taken: null,
        writeIndex: 2,
        message: "Write 3 at index 2.",
      },
      {
        action: "done",
        values: [1, 2, 3],
        low: null,
        high: null,
        mid: null,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message: "Every subarray has been merged. The array is sorted.",
      },
    ]);
  });

  it("reports an empty array in one step", () => {
    expect(outline(mergeSortSteps([]))).toEqual([
      {
        action: "done",
        values: [],
        low: null,
        high: null,
        mid: null,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message: "The array is empty, so it is already sorted.",
      },
    ]);
  });

  it("treats a single element as already sorted", () => {
    expect(outline(mergeSortSteps([7]))).toEqual([
      {
        action: "done",
        values: [7],
        low: null,
        high: null,
        mid: null,
        left: null,
        right: null,
        taken: null,
        writeIndex: null,
        message: "The only value is already sorted.",
      },
    ]);
  });

  it("does not rearrange an already sorted array", () => {
    const input = [1, 2, 3, 4];
    const steps = mergeSortSteps(input);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "split",
      "split",
      "compare",
      "write",
      "write",
      "split",
      "compare",
      "write",
      "write",
      "compare",
      "compare",
      "write",
      "write",
      "write",
      "write",
      "done",
    ]);
    expect(steps.filter((step) => step.action === "compare").every((step) => step.taken === "left")).toBe(
      true,
    );
    expect(steps.every((step) => [...step.values].every((value, index) => value === input[index]))).toBe(
      true,
    );
    expect(new Set(steps.map((step) => step.values)).size).toBe(1);
    expectSensibleTrace(input, steps);
  });

  it("sorts a reversed array", () => {
    const input = [3, 2, 1];
    const steps = mergeSortSteps(input);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "split",
      "split",
      "compare",
      "write",
      "write",
      "compare",
      "write",
      "write",
      "write",
      "done",
    ]);
    expect(steps.some((step) => step.taken === "right")).toBe(true);
    expect(steps.at(-1)?.values).toEqual([1, 2, 3]);
    expectSensibleTrace(input, steps);
  });

  it("takes the left value when two equal elements are compared", () => {
    const input = [2, 2, 1, 2];
    const steps = mergeSortSteps(input);
    expect(steps.at(-1)?.values).toEqual([1, 2, 2, 2]);
    const ties = steps.filter(
      (step) =>
        step.action === "compare" &&
        step.left !== null &&
        step.right !== null &&
        step.values[step.left] === step.values[step.right],
    );
    expect(ties.length).toBeGreaterThan(0);
    expect(ties.every((step) => step.taken === "left")).toBe(true);
    expectSensibleTrace(input, steps);
  });

  it("sorts negatives without dropping duplicate values", () => {
    const input = [-1, -5, -1, 0];
    const steps = mergeSortSteps(input);
    expect(steps.at(-1)?.values).toEqual([-5, -1, -1, 0]);
    expect(steps.at(-1)?.action).toBe("done");
    expectSensibleTrace(input, steps);
  });

  it("ends on a sorted copy and keeps each step's shape sensible", () => {
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
      const steps = mergeSortSteps(input);
      expect(steps.at(-1)?.values).toEqual(sortedCopy(input));
      expect(steps.at(-1)?.values).not.toBe(input);
      expectSensibleTrace(input, steps);
    }
  });

  it("copies the array and does not mutate the caller", () => {
    const input = Object.freeze([3, 1, 2]);
    const steps = mergeSortSteps(input);
    expect(steps[0]?.values).toEqual([3, 1, 2]);
    expect(steps[0]?.values).not.toBe(input);
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expect(steps[3]?.values).toBe(steps[0]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toEqual([1, 1, 2]);
    for (const step of steps) {
      expect(() => {
        (step.values as number[])[0] = 9;
      }).toThrow(TypeError);
    }
    expect(input).toEqual([3, 1, 2]);

    const empty: readonly number[] = Object.freeze([]);
    const single: readonly number[] = Object.freeze([4]);
    expect(mergeSortSteps(empty)[0]?.values).not.toBe(empty);
    expect(mergeSortSteps(single)[0]?.values).not.toBe(single);
    expect(empty).toEqual([]);
    expect(single).toEqual([4]);
  });

  it("rejects non-finite input", () => {
    const nanInput = [1, Number.NaN];
    expect(() => mergeSortSteps(nanInput)).toThrow(/finite/);
    expect(nanInput).toEqual([1, Number.NaN]);
    expect(() => mergeSortSteps([Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => mergeSortSteps([0, Number.NEGATIVE_INFINITY])).toThrow(/finite/);
  });
});

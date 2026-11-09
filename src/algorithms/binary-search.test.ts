import { describe, expect, it } from "vitest";
import { binarySearchSteps, type BinarySearchStep } from "./binary-search.ts";

function outline(steps: readonly BinarySearchStep[]) {
  return steps.map((step) => ({
    comparison: step.comparison,
    low: step.low,
    high: step.high,
    mid: step.mid,
    foundIndex: step.foundIndex,
    message: step.message,
  }));
}

describe("binarySearchSteps", () => {
  it("finds a value on the right by discarding the left half", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 16);
    expect(outline(steps)).toEqual([
      {
        comparison: "init",
        low: 0,
        high: 3,
        mid: null,
        foundIndex: null,
        message: "Start with the full range, indices 0 through 3.",
      },
      {
        comparison: "less",
        low: 0,
        high: 3,
        mid: 1,
        foundIndex: null,
        message:
          "Index 1 holds 4, which is less than 16. Drop the left side and continue from index 2.",
      },
      {
        comparison: "less",
        low: 2,
        high: 3,
        mid: 2,
        foundIndex: null,
        message:
          "Index 2 holds 9, which is less than 16. Drop the left side and continue from index 3.",
      },
      {
        comparison: "equal",
        low: 3,
        high: 3,
        mid: 3,
        foundIndex: 3,
        message: "Index 3 holds 16, which equals 16.",
      },
    ]);
  });

  it("finds a value on the left and names a one-cell window", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 1);
    expect(steps.map((step) => step.comparison)).toEqual(["init", "greater", "equal"]);
    expect(steps[0]?.message).toBe("Start with the full range, indices 0 through 3.");
    expect(steps[1]).toMatchObject({ low: 0, high: 3, mid: 1, comparison: "greater" });
    expect(steps[2]).toMatchObject({
      low: 0,
      high: 0,
      mid: 0,
      comparison: "equal",
      foundIndex: 0,
      message: "Index 0 holds 1, which equals 1.",
    });
  });

  it("ends on an empty window when the target is missing", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 3);
    expect(steps.map((step) => step.comparison)).toEqual([
      "init",
      "greater",
      "less",
      "absent",
    ]);
    expect(steps.at(-1)).toMatchObject({
      low: 1,
      high: 0,
      mid: null,
      foundIndex: null,
      message: "The search window is empty, so 3 is not in the array.",
    });
  });

  it("reports an empty array in one step", () => {
    expect(outline(binarySearchSteps([], 4))).toEqual([
      {
        comparison: "absent",
        low: 0,
        high: -1,
        mid: null,
        foundIndex: null,
        message: "The array is empty, so 4 is not in it.",
      },
    ]);
  });

  it("checks the only cell of a one-element array", () => {
    const hit = binarySearchSteps([8], 8);
    expect(hit.map((step) => step.comparison)).toEqual(["init", "equal"]);
    expect(hit[0]?.message).toBe("Start with the only index, 0.");
    expect(hit[1]?.foundIndex).toBe(0);

    const miss = binarySearchSteps([8], 9);
    expect(miss.map((step) => [step.comparison, step.low, step.high])).toEqual([
      ["init", 0, 0],
      ["less", 0, 0],
      ["absent", 1, 0],
    ]);
  });

  it("may return any matching index when values repeat", () => {
    const steps = binarySearchSteps([2, 2, 2, 2], 2);
    const found = steps.find((step) => step.comparison === "equal");
    expect(found?.foundIndex).toBe(1);
    expect(steps.at(-1)?.comparison).toBe("equal");
  });

  it("keeps every probe inside the window it describes", () => {
    const steps = binarySearchSteps([2, 5, 8, 12, 16, 23, 38], 12);
    for (const step of steps) {
      if (step.mid === null) continue;
      expect(step.mid).toBeGreaterThanOrEqual(step.low);
      expect(step.mid).toBeLessThanOrEqual(step.high);
      expect(step.values[step.mid]).toBe([2, 5, 8, 12, 16, 23, 38][step.mid]);
    }
    expect(steps.at(-1)?.foundIndex).toBe(3);
  });

  it("agrees with a linear scan on random sorted arrays", () => {
    for (let length = 0; length <= 12; length += 1) {
      const values = Array.from({ length }, (_, index) => index * 2);
      for (const target of [-1, 0, 1, values.length, values[values.length - 1] ?? 0]) {
        const steps = binarySearchSteps(values, target);
        const found = steps.find((step) => step.comparison === "equal");
        const expected = values.indexOf(target);
        if (expected === -1) {
          expect(found).toBeUndefined();
          expect(steps.at(-1)?.comparison).toBe("absent");
          expect(steps.at(-1)?.foundIndex).toBeNull();
        } else {
          expect(found?.foundIndex).toBe(expected);
        }
        expect(steps.filter((step) => step.comparison === "equal")).toHaveLength(
          expected === -1 ? 0 : 1,
        );
      }
    }
  });

  it("copies the array and does not mutate the caller", () => {
    const input = Object.freeze([1, 3, 5]);
    const steps = binarySearchSteps(input, 5);
    expect(steps[0]?.values).toEqual([1, 3, 5]);
    expect(steps[0]?.values).not.toBe(input);
    expect(steps.every((step) => step.values === steps[0]?.values)).toBe(true);
    expect(() => {
      (steps[0]?.values as number[])[0] = 9;
    }).toThrow(TypeError);
  });

  it("rejects unsorted or non-finite input", () => {
    expect(() => binarySearchSteps([1, 3, 2], 2)).toThrow(/non-decreasing/);
    expect(() => binarySearchSteps([1, Number.NaN], 1)).toThrow(/finite/);
    expect(() => binarySearchSteps([1, 2], Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

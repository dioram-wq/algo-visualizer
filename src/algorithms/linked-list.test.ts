import { describe, expect, it } from "vitest";
import {
  linkedListSteps,
  type LinkedListOperation,
  type LinkedListStep,
} from "./linked-list.ts";

function outline(steps: readonly LinkedListStep[]) {
  return steps.map((current) => ({
    action: current.action,
    values: [...current.values],
    operation: current.operation === null ? null : { ...current.operation },
    value: current.value,
    index: current.index,
    message: current.message,
  }));
}

function oracle(operations: readonly LinkedListOperation[], initial: readonly number[]) {
  const list = initial.slice();
  const trace: {
    action: string;
    values: number[];
    value: number | null;
    index: number | null;
  }[] = [{ action: "start", values: list.slice(), value: null, index: null }];
  for (const operation of operations) {
    if (operation.op === "insert-head") {
      list.unshift(operation.value);
      trace.push({
        action: "insert-head",
        values: list.slice(),
        value: operation.value,
        index: 0,
      });
      continue;
    }
    if (operation.op === "insert-tail") {
      list.push(operation.value);
      trace.push({
        action: "insert-tail",
        values: list.slice(),
        value: operation.value,
        index: list.length - 1,
      });
      continue;
    }
    const found = list.indexOf(operation.value);
    if (found === -1) {
      trace.push({
        action: "not-found",
        values: list.slice(),
        value: operation.value,
        index: null,
      });
      continue;
    }
    if (operation.op === "search") {
      trace.push({ action: "search", values: list.slice(), value: operation.value, index: found });
      continue;
    }
    list.splice(found, 1);
    trace.push({ action: "delete", values: list.slice(), value: operation.value, index: found });
  }
  return trace;
}

function script(seed: number, length: number): LinkedListOperation[] {
  let state = seed >>> 0;
  const operations: LinkedListOperation[] = [];
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const roll = state % 6;
    const value = (state % 11) - 5;
    if (roll <= 1) operations.push({ op: "insert-head", value });
    else if (roll === 2) operations.push({ op: "insert-tail", value });
    else if (roll === 3) operations.push({ op: "search", value });
    else operations.push({ op: "delete", value });
  }
  return operations;
}

describe("linkedListSteps", () => {
  it("inserts at the head and tail, then searches and deletes", () => {
    const steps = linkedListSteps([
      { op: "insert-head", value: 4 },
      { op: "insert-tail", value: 9 },
      { op: "insert-head", value: 1 },
      { op: "search", value: 9 },
      { op: "search", value: 7 },
      { op: "delete", value: 1 },
      { op: "delete", value: 9 },
      { op: "delete", value: 4 },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        index: null,
        message: "Start with an empty list.",
      },
      {
        action: "insert-head",
        values: [4],
        operation: { op: "insert-head", value: 4 },
        value: 4,
        index: 0,
        message: "Insert 4 at the head. It is now the only value, and the head.",
      },
      {
        action: "insert-tail",
        values: [4, 9],
        operation: { op: "insert-tail", value: 9 },
        value: 9,
        index: 1,
        message:
          "Insert 9 at the tail. The list is now [4, 9], head to tail, 4 is the head, and 9 is the tail.",
      },
      {
        action: "insert-head",
        values: [1, 4, 9],
        operation: { op: "insert-head", value: 1 },
        value: 1,
        index: 0,
        message: "Insert 1 at the head. The list is now [1, 4, 9], head to tail, and 1 is the head.",
      },
      {
        action: "search",
        values: [1, 4, 9],
        operation: { op: "search", value: 9 },
        value: 9,
        index: 2,
        message:
          "Search finds 9 at the tail. The list stays [1, 4, 9], head to tail, and 1 stays the head.",
      },
      {
        action: "not-found",
        values: [1, 4, 9],
        operation: { op: "search", value: 7 },
        value: 7,
        index: null,
        message: "Search for 7. It is not in [1, 4, 9].",
      },
      {
        action: "delete",
        values: [4, 9],
        operation: { op: "delete", value: 1 },
        value: 1,
        index: 0,
        message: "Delete 1 from the head. The list is now [4, 9], head to tail, and 4 is the head.",
      },
      {
        action: "delete",
        values: [4],
        operation: { op: "delete", value: 9 },
        value: 9,
        index: 1,
        message: "Delete 9 from the tail. The list is now [4], and 4 is the head.",
      },
      {
        action: "delete",
        values: [],
        operation: { op: "delete", value: 4 },
        value: 4,
        index: 0,
        message: "Delete 4. The list is now empty.",
      },
    ]);
    expect(steps[4]?.values).toBe(steps[3]?.values);
    expect(steps[5]?.values).toBe(steps[3]?.values);
    expect(steps[1]?.values).not.toBe(steps[0]?.values);
    expect(steps[6]?.values).not.toBe(steps[3]?.values);
  });

  it("searches without changing the list, including a one-value list", () => {
    const steps = linkedListSteps([
      { op: "insert-head", value: 6 },
      { op: "search", value: 6 },
      { op: "search", value: 6 },
    ]);
    expect(steps.map((current) => current.action)).toEqual([
      "start",
      "insert-head",
      "search",
      "search",
    ]);
    expect(steps[2]).toMatchObject({
      values: [6],
      value: 6,
      index: 0,
      message: "Search finds 6. It stays the head.",
    });
    expect(steps[2]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.index).toBe(0);
  });

  it("records a miss on an empty list, then continues", () => {
    const steps = linkedListSteps([
      { op: "search", value: 4 },
      { op: "delete", value: 4 },
      { op: "insert-tail", value: 1 },
      { op: "delete", value: 1 },
      { op: "delete", value: 1 },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        index: null,
        message: "Start with an empty list.",
      },
      {
        action: "not-found",
        values: [],
        operation: { op: "search", value: 4 },
        value: 4,
        index: null,
        message: "Search an empty list for 4. It is not there.",
      },
      {
        action: "not-found",
        values: [],
        operation: { op: "delete", value: 4 },
        value: 4,
        index: null,
        message: "Delete 4 from an empty list. It is not there.",
      },
      {
        action: "insert-tail",
        values: [1],
        operation: { op: "insert-tail", value: 1 },
        value: 1,
        index: 0,
        message: "Insert 1 at the tail. It is now the only value, and the head.",
      },
      {
        action: "delete",
        values: [],
        operation: { op: "delete", value: 1 },
        value: 1,
        index: 0,
        message: "Delete 1. The list is now empty.",
      },
      {
        action: "not-found",
        values: [],
        operation: { op: "delete", value: 1 },
        value: 1,
        index: null,
        message: "Delete 1 from an empty list. It is not there.",
      },
    ]);
    expect(steps[0]?.values).toBe(steps[1]?.values);
    expect(steps[1]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toBe(steps[5]?.values);
  });

  it("records a miss when the value is absent from a non-empty list", () => {
    const steps = linkedListSteps(
      [
        { op: "search", value: 7 },
        { op: "delete", value: 7 },
        { op: "search", value: 1 },
      ],
      [1, 4, 9],
    );
    expect(steps[1]).toMatchObject({
      action: "not-found",
      values: [1, 4, 9],
      value: 7,
      index: null,
      message: "Search for 7. It is not in [1, 4, 9].",
    });
    expect(steps[2]).toMatchObject({
      action: "not-found",
      values: [1, 4, 9],
      value: 7,
      index: null,
      message: "Delete 7. It is not in [1, 4, 9].",
    });
    expect(steps[3]).toMatchObject({
      action: "search",
      values: [1, 4, 9],
      value: 1,
      index: 0,
      message:
        "Search finds 1 at the head. The list stays [1, 4, 9], head to tail, and 1 stays the head.",
    });
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expect(steps[2]?.values).toBe(steps[0]?.values);
    expect(steps[3]?.values).toBe(steps[0]?.values);
  });

  it("deletes the head, the tail, and a middle value", () => {
    const steps = linkedListSteps([
      { op: "insert-tail", value: 1 },
      { op: "insert-tail", value: 2 },
      { op: "insert-tail", value: 3 },
      { op: "delete", value: 2 },
      { op: "insert-tail", value: 2 },
      { op: "delete", value: 1 },
      { op: "delete", value: 2 },
    ]);
    expect(steps[4]).toMatchObject({
      action: "delete",
      values: [1, 3],
      value: 2,
      index: 1,
      message: "Delete 2. The list is now [1, 3], head to tail, and 1 is the head.",
    });
    expect(steps[6]).toMatchObject({
      action: "delete",
      values: [3, 2],
      value: 1,
      index: 0,
      message: "Delete 1 from the head. The list is now [3, 2], head to tail, and 3 is the head.",
    });
    expect(steps[7]).toMatchObject({
      action: "delete",
      values: [3],
      value: 2,
      index: 1,
      message: "Delete 2 from the tail. The list is now [3], and 3 is the head.",
    });
  });

  it("deletes only the first match when a value is repeated", () => {
    const steps = linkedListSteps(
      [
        { op: "search", value: 4 },
        { op: "delete", value: 4 },
        { op: "delete", value: 4 },
      ],
      [4, 9, 4],
    );
    expect(steps[1]).toMatchObject({
      action: "search",
      value: 4,
      index: 0,
      values: [4, 9, 4],
    });
    expect(steps[2]).toMatchObject({
      action: "delete",
      values: [9, 4],
      value: 4,
      index: 0,
      message: "Delete 4 from the head. The list is now [9, 4], head to tail, and 9 is the head.",
    });
    expect(steps[3]).toMatchObject({
      action: "delete",
      values: [9],
      value: 4,
      index: 1,
      message: "Delete 4 from the tail. The list is now [9], and 9 is the head.",
    });
  });

  it("names the head of a given list and a search in the middle", () => {
    const steps = linkedListSteps([{ op: "search", value: 4 }], [1, 4, 9]);
    expect(steps[0]).toMatchObject({
      action: "start",
      values: [1, 4, 9],
      operation: null,
      value: null,
      index: null,
      message: "Start with [1, 4, 9], head to tail. 1 is the head.",
    });
    expect(steps[1]).toMatchObject({
      action: "search",
      values: [1, 4, 9],
      value: 4,
      index: 1,
      message:
        "Search finds 4 at index 1. The list stays [1, 4, 9], head to tail, and 1 stays the head.",
    });
    expect(linkedListSteps([], [7])[0]?.message).toBe("Start with 7 in the list. It is the head.");
  });

  it("records only the opening snapshot when there are no operations", () => {
    expect(outline(linkedListSteps([]))).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        index: null,
        message: "Start with an empty list.",
      },
    ]);
    const given = linkedListSteps([], [2, 5]);
    expect(given).toHaveLength(1);
    expect(given[0]?.values).toEqual([2, 5]);
  });

  it("agrees with a direct list on mixed operations", () => {
    const initials = [[], [0], [-2, 4], [8, 8, 1]];
    for (let seed = 1; seed <= 8; seed += 1) {
      for (let length = 0; length <= 12; length += 1) {
        const operations = script(seed * 100 + length, length);
        for (const initial of initials) {
          const steps = linkedListSteps(operations, initial);
          const expected = oracle(operations, initial);
          expect(steps.map((current) => current.action)).toEqual(
            expected.map((current) => current.action),
          );
          expect(steps.map((current) => [...current.values])).toEqual(
            expected.map((current) => current.values),
          );
          expect(steps.map((current) => current.value)).toEqual(
            expected.map((current) => current.value),
          );
          expect(steps.map((current) => current.index)).toEqual(
            expected.map((current) => current.index),
          );
          expect(steps[0]?.operation).toBeNull();
          for (let index = 1; index < steps.length; index += 1) {
            expect(steps[index]?.operation).toEqual(operations[index - 1]);
            expect(steps[index]?.message.length).toBeGreaterThan(0);
            expect(Object.isFrozen(steps[index]?.values)).toBe(true);
            expect(Object.isFrozen(steps[index]?.operation)).toBe(true);
          }
        }
      }
    }
  });

  it("does not mutate the operations or the starting list", () => {
    const initial = [1, 2];
    const insert = { op: "insert-head" as const, value: 3 };
    const operations: LinkedListOperation[] = [
      insert,
      insert,
      { op: "search", value: 3 },
      { op: "delete", value: 1 },
    ];
    const initialBefore = initial.slice();
    const operationsBefore = operations.map((operation) => ({
      op: operation.op,
      value: operation.value,
    }));

    const steps = linkedListSteps(operations, initial);

    expect(initial).toEqual(initialBefore);
    expect(operations).toEqual(operationsBefore);
    expect(steps[0]?.values).not.toBe(initial);
    expect(steps[1]?.operation).not.toBe(insert);
    expect(steps[2]?.operation).not.toBe(insert);
    expect(steps[1]?.operation).not.toBe(steps[2]?.operation);

    initial[0] = 99;
    initial.push(8);
    insert.value = 100;
    operations[1] = { op: "delete", value: 3 };
    operations.push({ op: "search", value: 2 });

    expect(steps[0]?.values).toEqual([1, 2]);
    expect(steps[1]?.values).toEqual([3, 1, 2]);
    expect(steps[1]?.operation).toEqual({ op: "insert-head", value: 3 });
    expect(steps[2]?.values).toEqual([3, 3, 1, 2]);
    expect(steps[2]?.index).toBe(0);
    expect(steps[3]?.action).toBe("search");
    expect(steps[3]?.index).toBe(0);
    expect(steps[3]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.action).toBe("delete");
    expect(steps[4]?.values).toEqual([3, 3, 2]);
    expect(steps[4]?.index).toBe(2);

    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    expect(() => {
      (steps[0]?.values as number[])[0] = 7;
    }).toThrow(TypeError);
    expect(Object.isFrozen(steps[1]?.operation)).toBe(true);
    expect(() => {
      (steps[1]?.operation as { value: number }).value = 7;
    }).toThrow(TypeError);
  });

  it("accepts a frozen starting list and frozen operations", () => {
    const initial = Object.freeze([4, 1]);
    const operations = Object.freeze([
      Object.freeze({ op: "insert-tail" as const, value: 0 }),
      Object.freeze({ op: "delete" as const, value: 4 }),
      Object.freeze({ op: "search" as const, value: 0 }),
    ]);
    const steps = linkedListSteps(operations, initial);
    expect(steps.map((current) => [...current.values])).toEqual([
      [4, 1],
      [4, 1, 0],
      [1, 0],
      [1, 0],
    ]);
    expect(steps[2]?.index).toBe(0);
    expect(steps[3]?.index).toBe(1);
    expect(steps[3]?.value).toBe(0);
    expect(initial).toEqual([4, 1]);
    expect(operations[0]).toEqual({ op: "insert-tail", value: 0 });
  });

  it("rejects non-finite values and unknown operations", () => {
    expect(() => linkedListSteps([], [1, Number.NaN])).toThrow(/finite/);
    expect(() => linkedListSteps([], [Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => linkedListSteps([{ op: "insert-head", value: Number.NEGATIVE_INFINITY }])).toThrow(
      /finite/,
    );
    expect(() => linkedListSteps([{ op: "search", value: Number.NaN }])).toThrow(/finite/);
    expect(() => linkedListSteps([{ op: "delete", value: Number.NaN }])).toThrow(/finite/);
    expect(() =>
      linkedListSteps([{ op: "shift" } as unknown as LinkedListOperation]),
    ).toThrow(/insert-head, insert-tail, search, or delete/);
    expect(() => linkedListSteps([null as unknown as LinkedListOperation])).toThrow(
      /insert-head, insert-tail, search, or delete/,
    );
    expect(() =>
      linkedListSteps([{ op: "insert-tail" } as unknown as LinkedListOperation]),
    ).toThrow(/finite/);
  });
});

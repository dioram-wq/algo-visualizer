import { describe, expect, it } from "vitest";
import { stackSteps, type StackOperation, type StackStep } from "./stack.ts";

function outline(steps: readonly StackStep[]) {
  return steps.map((current) => ({
    action: current.action,
    values: [...current.values],
    operation: current.operation === null ? null : { ...current.operation },
    value: current.value,
    message: current.message,
  }));
}

function oracle(operations: readonly StackOperation[], initial: readonly number[]) {
  const stack = initial.slice();
  const trace: { action: string; values: number[]; value: number | null }[] = [
    { action: "start", values: stack.slice(), value: null },
  ];
  for (const operation of operations) {
    if (operation.op === "push") {
      stack.push(operation.value);
      trace.push({ action: "push", values: stack.slice(), value: operation.value });
      continue;
    }
    if (stack.length === 0) {
      trace.push({ action: "underflow", values: stack.slice(), value: null });
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === undefined) throw new Error("Oracle lost the top of the stack.");
    if (operation.op === "peek") {
      trace.push({ action: "peek", values: stack.slice(), value: top });
      continue;
    }
    stack.pop();
    trace.push({ action: "pop", values: stack.slice(), value: top });
  }
  return trace;
}

function script(seed: number, length: number): StackOperation[] {
  let state = seed >>> 0;
  const operations: StackOperation[] = [];
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const roll = state % 5;
    if (roll <= 1) operations.push({ op: "push", value: (state % 11) - 5 });
    else if (roll === 2) operations.push({ op: "peek" });
    else operations.push({ op: "pop" });
  }
  return operations;
}

describe("stackSteps", () => {
  it("pushes and pops in last-in first-out order", () => {
    const steps = stackSteps([
      { op: "push", value: 4 },
      { op: "push", value: 9 },
      { op: "peek" },
      { op: "pop" },
      { op: "push", value: 2 },
      { op: "pop" },
      { op: "pop" },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty stack.",
      },
      {
        action: "push",
        values: [4],
        operation: { op: "push", value: 4 },
        value: 4,
        message: "Push 4. It is now the only value, on top.",
      },
      {
        action: "push",
        values: [4, 9],
        operation: { op: "push", value: 9 },
        value: 9,
        message: "Push 9. The stack is now [4, 9], bottom to top, and 9 is on top.",
      },
      {
        action: "peek",
        values: [4, 9],
        operation: { op: "peek" },
        value: 9,
        message: "Peek 9. The stack stays [4, 9], bottom to top, and 9 stays on top.",
      },
      {
        action: "pop",
        values: [4],
        operation: { op: "pop" },
        value: 9,
        message: "Pop 9. The stack is now [4], and 4 is on top.",
      },
      {
        action: "push",
        values: [4, 2],
        operation: { op: "push", value: 2 },
        value: 2,
        message: "Push 2. The stack is now [4, 2], bottom to top, and 2 is on top.",
      },
      {
        action: "pop",
        values: [4],
        operation: { op: "pop" },
        value: 2,
        message: "Pop 2. The stack is now [4], and 4 is on top.",
      },
      {
        action: "pop",
        values: [],
        operation: { op: "pop" },
        value: 4,
        message: "Pop 4. The stack is now empty.",
      },
    ]);
    expect(steps[3]?.values).toBe(steps[2]?.values);
    expect(steps[1]?.values).not.toBe(steps[0]?.values);
  });

  it("peeks without removing the top, including a one-value stack", () => {
    const steps = stackSteps([{ op: "push", value: 6 }, { op: "peek" }, { op: "peek" }]);
    expect(steps.map((current) => current.action)).toEqual(["start", "push", "peek", "peek"]);
    expect(steps[2]).toMatchObject({
      values: [6],
      value: 6,
      message: "Peek 6. It stays on top.",
    });
    expect(steps[2]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.value).toBe(6);
  });

  it("records underflow for pop and peek on an empty stack, then continues", () => {
    const steps = stackSteps([
      { op: "pop" },
      { op: "peek" },
      { op: "push", value: 1 },
      { op: "pop" },
      { op: "pop" },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty stack.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "pop" },
        value: null,
        message: "Pop an empty stack. Nothing comes off.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "peek" },
        value: null,
        message: "Peek an empty stack. There is no top value.",
      },
      {
        action: "push",
        values: [1],
        operation: { op: "push", value: 1 },
        value: 1,
        message: "Push 1. It is now the only value, on top.",
      },
      {
        action: "pop",
        values: [],
        operation: { op: "pop" },
        value: 1,
        message: "Pop 1. The stack is now empty.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "pop" },
        value: null,
        message: "Pop an empty stack. Nothing comes off.",
      },
    ]);
    expect(steps[0]?.values).toBe(steps[1]?.values);
    expect(steps[1]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toBe(steps[5]?.values);
  });

  it("starts from a given stack and names the top", () => {
    const steps = stackSteps([{ op: "pop" }, { op: "peek" }, { op: "pop" }], [1, 4]);
    expect(steps[0]).toMatchObject({
      action: "start",
      values: [1, 4],
      operation: null,
      value: null,
      message: "Start with [1, 4], bottom to top. 4 is on top.",
    });
    expect(steps[1]).toMatchObject({
      action: "pop",
      values: [1],
      value: 4,
      message: "Pop 4. The stack is now [1], and 1 is on top.",
    });
    expect(steps[2]).toMatchObject({
      action: "peek",
      values: [1],
      value: 1,
      message: "Peek 1. It stays on top.",
    });
    expect(steps[3]).toMatchObject({
      action: "pop",
      values: [],
      value: 1,
      message: "Pop 1. The stack is now empty.",
    });
    expect(stackSteps([], [7])[0]?.message).toBe("Start with 7 on the stack. It is the top.");
  });

  it("names the top after a pop that still leaves several values", () => {
    const steps = stackSteps([
      { op: "push", value: 1 },
      { op: "push", value: 2 },
      { op: "push", value: 3 },
      { op: "pop" },
    ]);
    expect(steps[4]).toMatchObject({
      action: "pop",
      values: [1, 2],
      value: 3,
      message: "Pop 3. The stack is now [1, 2], bottom to top, and 2 is on top.",
    });
  });

  it("records only the opening snapshot when there are no operations", () => {
    expect(outline(stackSteps([]))).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty stack.",
      },
    ]);
    const given = stackSteps([], [2, 5]);
    expect(given).toHaveLength(1);
    expect(given[0]?.values).toEqual([2, 5]);
  });

  it("agrees with a direct stack on mixed operations", () => {
    const initials = [[], [0], [-2, 4], [8, 8, 1]];
    for (let seed = 1; seed <= 8; seed += 1) {
      for (let length = 0; length <= 12; length += 1) {
        const operations = script(seed * 100 + length, length);
        for (const initial of initials) {
          const steps = stackSteps(operations, initial);
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

  it("does not mutate the operations or the starting stack", () => {
    const initial = [1, 2];
    const push = { op: "push" as const, value: 3 };
    const operations: StackOperation[] = [push, push, { op: "pop" }, { op: "peek" }];
    const initialBefore = initial.slice();
    const operationsBefore = operations.map((operation) =>
      operation.op === "push" ? { op: operation.op, value: operation.value } : { op: operation.op },
    );

    const steps = stackSteps(operations, initial);

    expect(initial).toEqual(initialBefore);
    expect(operations).toEqual(operationsBefore);
    expect(steps[0]?.values).not.toBe(initial);
    expect(steps[1]?.operation).not.toBe(push);
    expect(steps[2]?.operation).not.toBe(push);
    expect(steps[1]?.operation).not.toBe(steps[2]?.operation);

    initial[0] = 99;
    initial.push(8);
    push.value = 100;
    operations[1] = { op: "pop" };
    operations.push({ op: "peek" });

    expect(steps[0]?.values).toEqual([1, 2]);
    expect(steps[1]?.values).toEqual([1, 2, 3]);
    expect(steps[1]?.operation).toEqual({ op: "push", value: 3 });
    expect(steps[2]?.values).toEqual([1, 2, 3, 3]);
    expect(steps[2]?.value).toBe(3);
    expect(steps[3]?.value).toBe(3);
    expect(steps[4]?.action).toBe("peek");
    expect(steps[4]?.values).toEqual([1, 2, 3]);

    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    expect(() => {
      (steps[0]?.values as number[])[0] = 7;
    }).toThrow(TypeError);
    expect(Object.isFrozen(steps[1]?.operation)).toBe(true);
    expect(() => {
      (steps[1]?.operation as { value: number }).value = 7;
    }).toThrow(TypeError);
  });

  it("accepts a frozen starting stack and frozen operations", () => {
    const initial = Object.freeze([4, 1]);
    const operations = Object.freeze([
      Object.freeze({ op: "push" as const, value: 0 }),
      Object.freeze({ op: "pop" as const }),
      Object.freeze({ op: "peek" as const }),
    ]);
    const steps = stackSteps(operations, initial);
    expect(steps.map((current) => [...current.values])).toEqual([
      [4, 1],
      [4, 1, 0],
      [4, 1],
      [4, 1],
    ]);
    expect(steps[3]?.value).toBe(1);
    expect(initial).toEqual([4, 1]);
    expect(operations[0]).toEqual({ op: "push", value: 0 });
  });

  it("rejects non-finite values and unknown operations", () => {
    expect(() => stackSteps([], [1, Number.NaN])).toThrow(/finite/);
    expect(() => stackSteps([], [Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => stackSteps([{ op: "push", value: Number.NEGATIVE_INFINITY }])).toThrow(/finite/);
    expect(() => stackSteps([{ op: "push", value: Number.NaN }])).toThrow(/finite/);
    expect(() => stackSteps([{ op: "shift" } as unknown as StackOperation])).toThrow(
      /push, pop, or peek/,
    );
    expect(() => stackSteps([null as unknown as StackOperation])).toThrow(/push, pop, or peek/);
    expect(() =>
      stackSteps([{ op: "push" } as unknown as StackOperation]),
    ).toThrow(/finite/);
  });
});

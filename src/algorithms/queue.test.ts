import { describe, expect, it } from "vitest";
import { queueSteps, type QueueOperation, type QueueStep } from "./queue.ts";

function outline(steps: readonly QueueStep[]) {
  return steps.map((current) => ({
    action: current.action,
    values: [...current.values],
    operation: current.operation === null ? null : { ...current.operation },
    value: current.value,
    message: current.message,
  }));
}

function oracle(operations: readonly QueueOperation[], initial: readonly number[]) {
  const queue = initial.slice();
  const trace: { action: string; values: number[]; value: number | null }[] = [
    { action: "start", values: queue.slice(), value: null },
  ];
  for (const operation of operations) {
    if (operation.op === "enqueue") {
      queue.push(operation.value);
      trace.push({ action: "enqueue", values: queue.slice(), value: operation.value });
      continue;
    }
    if (queue.length === 0) {
      trace.push({ action: "underflow", values: queue.slice(), value: null });
      continue;
    }
    const front = queue[0];
    if (front === undefined) throw new Error("Oracle lost the front of the queue.");
    if (operation.op === "peek") {
      trace.push({ action: "peek", values: queue.slice(), value: front });
      continue;
    }
    queue.shift();
    trace.push({ action: "dequeue", values: queue.slice(), value: front });
  }
  return trace;
}

function script(seed: number, length: number): QueueOperation[] {
  let state = seed >>> 0;
  const operations: QueueOperation[] = [];
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const roll = state % 5;
    if (roll <= 1) operations.push({ op: "enqueue", value: (state % 11) - 5 });
    else if (roll === 2) operations.push({ op: "peek" });
    else operations.push({ op: "dequeue" });
  }
  return operations;
}

describe("queueSteps", () => {
  it("enqueues and dequeues in first-in first-out order", () => {
    const steps = queueSteps([
      { op: "enqueue", value: 4 },
      { op: "enqueue", value: 9 },
      { op: "peek" },
      { op: "dequeue" },
      { op: "enqueue", value: 2 },
      { op: "dequeue" },
      { op: "dequeue" },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty queue.",
      },
      {
        action: "enqueue",
        values: [4],
        operation: { op: "enqueue", value: 4 },
        value: 4,
        message: "Enqueue 4. It is now the only value, at the front.",
      },
      {
        action: "enqueue",
        values: [4, 9],
        operation: { op: "enqueue", value: 9 },
        value: 9,
        message: "Enqueue 9. The queue is now [4, 9], front to back, and 4 is at the front.",
      },
      {
        action: "peek",
        values: [4, 9],
        operation: { op: "peek" },
        value: 4,
        message: "Peek 4. The queue stays [4, 9], front to back, and 4 stays at the front.",
      },
      {
        action: "dequeue",
        values: [9],
        operation: { op: "dequeue" },
        value: 4,
        message: "Dequeue 4. The queue is now [9], and 9 is at the front.",
      },
      {
        action: "enqueue",
        values: [9, 2],
        operation: { op: "enqueue", value: 2 },
        value: 2,
        message: "Enqueue 2. The queue is now [9, 2], front to back, and 9 is at the front.",
      },
      {
        action: "dequeue",
        values: [2],
        operation: { op: "dequeue" },
        value: 9,
        message: "Dequeue 9. The queue is now [2], and 2 is at the front.",
      },
      {
        action: "dequeue",
        values: [],
        operation: { op: "dequeue" },
        value: 2,
        message: "Dequeue 2. The queue is now empty.",
      },
    ]);
    expect(steps[3]?.values).toBe(steps[2]?.values);
    expect(steps[1]?.values).not.toBe(steps[0]?.values);
  });

  it("peeks without removing the front, including a one-value queue", () => {
    const steps = queueSteps([{ op: "enqueue", value: 6 }, { op: "peek" }, { op: "peek" }]);
    expect(steps.map((current) => current.action)).toEqual(["start", "enqueue", "peek", "peek"]);
    expect(steps[2]).toMatchObject({
      values: [6],
      value: 6,
      message: "Peek 6. It stays at the front.",
    });
    expect(steps[2]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.values).toBe(steps[1]?.values);
    expect(steps[3]?.value).toBe(6);
  });

  it("records underflow for dequeue and peek on an empty queue, then continues", () => {
    const steps = queueSteps([
      { op: "dequeue" },
      { op: "peek" },
      { op: "enqueue", value: 1 },
      { op: "dequeue" },
      { op: "dequeue" },
    ]);

    expect(outline(steps)).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty queue.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "dequeue" },
        value: null,
        message: "Dequeue an empty queue. Nothing comes off.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "peek" },
        value: null,
        message: "Peek an empty queue. There is no front value.",
      },
      {
        action: "enqueue",
        values: [1],
        operation: { op: "enqueue", value: 1 },
        value: 1,
        message: "Enqueue 1. It is now the only value, at the front.",
      },
      {
        action: "dequeue",
        values: [],
        operation: { op: "dequeue" },
        value: 1,
        message: "Dequeue 1. The queue is now empty.",
      },
      {
        action: "underflow",
        values: [],
        operation: { op: "dequeue" },
        value: null,
        message: "Dequeue an empty queue. Nothing comes off.",
      },
    ]);
    expect(steps[0]?.values).toBe(steps[1]?.values);
    expect(steps[1]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toBe(steps[5]?.values);
  });

  it("starts from a given queue and names the front", () => {
    const steps = queueSteps([{ op: "dequeue" }, { op: "peek" }, { op: "dequeue" }], [1, 4]);
    expect(steps[0]).toMatchObject({
      action: "start",
      values: [1, 4],
      operation: null,
      value: null,
      message: "Start with [1, 4], front to back. 1 is at the front.",
    });
    expect(steps[1]).toMatchObject({
      action: "dequeue",
      values: [4],
      value: 1,
      message: "Dequeue 1. The queue is now [4], and 4 is at the front.",
    });
    expect(steps[2]).toMatchObject({
      action: "peek",
      values: [4],
      value: 4,
      message: "Peek 4. It stays at the front.",
    });
    expect(steps[3]).toMatchObject({
      action: "dequeue",
      values: [],
      value: 4,
      message: "Dequeue 4. The queue is now empty.",
    });
    expect(queueSteps([], [7])[0]?.message).toBe("Start with 7 in the queue. It is the front.");
  });

  it("names the front after a dequeue that still leaves several values", () => {
    const steps = queueSteps([
      { op: "enqueue", value: 1 },
      { op: "enqueue", value: 2 },
      { op: "enqueue", value: 3 },
      { op: "dequeue" },
    ]);
    expect(steps[4]).toMatchObject({
      action: "dequeue",
      values: [2, 3],
      value: 1,
      message: "Dequeue 1. The queue is now [2, 3], front to back, and 2 is at the front.",
    });
  });

  it("records only the opening snapshot when there are no operations", () => {
    expect(outline(queueSteps([]))).toEqual([
      {
        action: "start",
        values: [],
        operation: null,
        value: null,
        message: "Start with an empty queue.",
      },
    ]);
    const given = queueSteps([], [2, 5]);
    expect(given).toHaveLength(1);
    expect(given[0]?.values).toEqual([2, 5]);
  });

  it("agrees with a direct queue on mixed operations", () => {
    const initials = [[], [0], [-2, 4], [8, 8, 1]];
    for (let seed = 1; seed <= 8; seed += 1) {
      for (let length = 0; length <= 12; length += 1) {
        const operations = script(seed * 100 + length, length);
        for (const initial of initials) {
          const steps = queueSteps(operations, initial);
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

  it("does not mutate the operations or the starting queue", () => {
    const initial = [1, 2];
    const enqueue = { op: "enqueue" as const, value: 3 };
    const operations: QueueOperation[] = [enqueue, enqueue, { op: "dequeue" }, { op: "peek" }];
    const initialBefore = initial.slice();
    const operationsBefore = operations.map((operation) =>
      operation.op === "enqueue"
        ? { op: operation.op, value: operation.value }
        : { op: operation.op },
    );

    const steps = queueSteps(operations, initial);

    expect(initial).toEqual(initialBefore);
    expect(operations).toEqual(operationsBefore);
    expect(steps[0]?.values).not.toBe(initial);
    expect(steps[1]?.operation).not.toBe(enqueue);
    expect(steps[2]?.operation).not.toBe(enqueue);
    expect(steps[1]?.operation).not.toBe(steps[2]?.operation);

    initial[0] = 99;
    initial.push(8);
    enqueue.value = 100;
    operations[1] = { op: "dequeue" };
    operations.push({ op: "peek" });

    expect(steps[0]?.values).toEqual([1, 2]);
    expect(steps[1]?.values).toEqual([1, 2, 3]);
    expect(steps[1]?.operation).toEqual({ op: "enqueue", value: 3 });
    expect(steps[2]?.values).toEqual([1, 2, 3, 3]);
    expect(steps[2]?.value).toBe(3);
    expect(steps[3]?.value).toBe(1);
    expect(steps[4]?.action).toBe("peek");
    expect(steps[4]?.values).toEqual([2, 3, 3]);
    expect(steps[4]?.value).toBe(2);

    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    expect(() => {
      (steps[0]?.values as number[])[0] = 7;
    }).toThrow(TypeError);
    expect(Object.isFrozen(steps[1]?.operation)).toBe(true);
    expect(() => {
      (steps[1]?.operation as { value: number }).value = 7;
    }).toThrow(TypeError);
  });

  it("accepts a frozen starting queue and frozen operations", () => {
    const initial = Object.freeze([4, 1]);
    const operations = Object.freeze([
      Object.freeze({ op: "enqueue" as const, value: 0 }),
      Object.freeze({ op: "dequeue" as const }),
      Object.freeze({ op: "peek" as const }),
    ]);
    const steps = queueSteps(operations, initial);
    expect(steps.map((current) => [...current.values])).toEqual([
      [4, 1],
      [4, 1, 0],
      [1, 0],
      [1, 0],
    ]);
    expect(steps[3]?.value).toBe(1);
    expect(initial).toEqual([4, 1]);
    expect(operations[0]).toEqual({ op: "enqueue", value: 0 });
  });

  it("rejects non-finite values and unknown operations", () => {
    expect(() => queueSteps([], [1, Number.NaN])).toThrow(/finite/);
    expect(() => queueSteps([], [Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => queueSteps([{ op: "enqueue", value: Number.NEGATIVE_INFINITY }])).toThrow(
      /finite/,
    );
    expect(() => queueSteps([{ op: "enqueue", value: Number.NaN }])).toThrow(/finite/);
    expect(() => queueSteps([{ op: "shift" } as unknown as QueueOperation])).toThrow(
      /enqueue, dequeue, or peek/,
    );
    expect(() => queueSteps([null as unknown as QueueOperation])).toThrow(
      /enqueue, dequeue, or peek/,
    );
    expect(() => queueSteps([{ op: "enqueue" } as unknown as QueueOperation])).toThrow(/finite/);
  });
});

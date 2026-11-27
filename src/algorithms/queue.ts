import { codeLine, type CodeListing, type CodeStep } from "../code-panel.ts";

export type QueueOperation =
  | { readonly op: "enqueue"; readonly value: number }
  | { readonly op: "dequeue" }
  | { readonly op: "peek" };

export type QueueAction = "start" | "enqueue" | "dequeue" | "peek" | "underflow";

/**
 * Short queue pseudocode for enqueue, dequeue, and peek.
 * Start is the given queue. Enqueue adds at the back, dequeue removes the
 * front, and peek reads the front. An empty dequeue and an empty peek are
 * different underflow lines. The procedure headers sit between those lines.
 */
export const QUEUE_CODE: CodeListing = {
  lines: Object.freeze([
    "start with the queue",
    "enqueue(x)",
    "    add x at the back",
    "dequeue()",
    "    if dequeue and the queue is empty then underflow",
    "    remove the front",
    "peek()",
    "    if peek and the queue is empty then underflow",
    "    return the front",
  ]),
};

const QUEUE_LINE = {
  start: 0,
  enqueue: 2,
  dequeue: 5,
  peek: 8,
} as const satisfies Record<Exclude<QueueAction, "underflow">, number>;

/** The empty check inside dequeue. */
const QUEUE_DEQUEUE_UNDERFLOW_LINE = 4;

/** The empty check inside peek. */
const QUEUE_PEEK_UNDERFLOW_LINE = 7;

export interface QueueStep extends CodeStep {
  /** Contents after this step. Index 0 is the front and the last index is the back. */
  readonly values: readonly number[];
  readonly action: QueueAction;
  /** The operation that produced this step. Null on the opening snapshot. */
  readonly operation: QueueOperation | null;
  /** Value enqueued, dequeued, or peeked. Null on the opening snapshot and on underflow. */
  readonly value: number | null;
  /** 0-based index into `QUEUE_CODE.lines`. */
  readonly line: number;
  readonly message: string;
}

/**
 * Record each enqueue, dequeue, and peek on a queue.
 * The caller's operations and starting values are copied, and each snapshot
 * is frozen, so later edits do not rewrite old steps. Dequeue or peek on an
 * empty queue records an underflow and the trace continues.
 */
export function queueSteps(
  operations: readonly QueueOperation[],
  initial: readonly number[] = [],
): QueueStep[] {
  if (initial.some((value) => !Number.isFinite(value))) {
    throw new RangeError("queueSteps expects finite numbers.");
  }

  const working = initial.slice();
  let values = freeze(working);
  const steps: QueueStep[] = [step(values, "start", null, null)];

  for (const operation of operations) {
    const recorded = copyOperation(operation);
    if (recorded.op === "enqueue") {
      working.push(recorded.value);
      values = freeze(working);
      steps.push(step(values, "enqueue", recorded, recorded.value));
      continue;
    }

    if (working.length === 0) {
      steps.push(step(values, "underflow", recorded, null));
      continue;
    }

    const front = working[0];
    if (front === undefined) {
      throw new RangeError("Queue index fell outside the contents.");
    }
    if (recorded.op === "peek") {
      steps.push(step(values, "peek", recorded, front));
      continue;
    }

    working.shift();
    values = freeze(working);
    steps.push(step(values, "dequeue", recorded, front));
  }

  return steps;
}

function copyOperation(operation: QueueOperation): QueueOperation {
  const record = operation as { op?: unknown; value?: unknown } | null;
  if (record !== null && typeof record === "object") {
    if (record.op === "dequeue" || record.op === "peek") {
      return Object.freeze({ op: record.op });
    }
    if (record.op === "enqueue") {
      if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
        throw new RangeError("queueSteps expects finite numbers.");
      }
      return Object.freeze({ op: "enqueue", value: record.value });
    }
  }
  throw new RangeError("queueSteps expects enqueue, dequeue, or peek operations.");
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  action: QueueAction,
  operation: QueueOperation | null,
  value: number | null,
): QueueStep {
  return {
    values,
    action,
    operation,
    value,
    line: codeLine(QUEUE_CODE, lineFor(action, operation)),
    message: describe(values, action, operation, value),
  };
}

/** An empty dequeue and an empty peek highlight different checks. */
function lineFor(action: QueueAction, operation: QueueOperation | null): number {
  if (action === "underflow") {
    if (operation?.op === "dequeue") return QUEUE_DEQUEUE_UNDERFLOW_LINE;
    if (operation?.op === "peek") return QUEUE_PEEK_UNDERFLOW_LINE;
    throw new RangeError("An underflow step is missing its operation.");
  }
  return QUEUE_LINE[action];
}

function describe(
  values: readonly number[],
  action: QueueAction,
  operation: QueueOperation | null,
  value: number | null,
): string {
  switch (action) {
    case "start":
      return describeStart(values);
    case "enqueue":
      return describeEnqueue(values, requireValue(value));
    case "dequeue":
      return describeDequeue(values, requireValue(value));
    case "peek":
      return describePeek(values, requireValue(value));
    case "underflow":
      if (operation?.op === "peek") return "Peek an empty queue. There is no front value.";
      if (operation?.op === "dequeue") return "Dequeue an empty queue. Nothing comes off.";
      throw new RangeError("An underflow step is missing its operation.");
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected queue action: ${String(unexpected)}`);
    }
  }
}

function describeStart(values: readonly number[]): string {
  if (values.length === 0) return "Start with an empty queue.";
  if (values.length === 1) {
    return `Start with ${formatValue(values[0])} in the queue. It is the front.`;
  }
  return `Start with ${formatQueue(values)}, front to back. ${formatValue(frontOf(values))} is at the front.`;
}

function describeEnqueue(values: readonly number[], value: number): string {
  if (values.length === 1) {
    return `Enqueue ${formatValue(value)}. It is now the only value, at the front.`;
  }
  return `Enqueue ${formatValue(value)}. The queue is now ${formatQueue(values)}, front to back, and ${formatValue(frontOf(values))} is at the front.`;
}

function describeDequeue(values: readonly number[], value: number): string {
  if (values.length === 0) return `Dequeue ${formatValue(value)}. The queue is now empty.`;
  if (values.length === 1) {
    return `Dequeue ${formatValue(value)}. The queue is now ${formatQueue(values)}, and ${formatValue(frontOf(values))} is at the front.`;
  }
  return `Dequeue ${formatValue(value)}. The queue is now ${formatQueue(values)}, front to back, and ${formatValue(frontOf(values))} is at the front.`;
}

function describePeek(values: readonly number[], value: number): string {
  if (values.length === 1) return `Peek ${formatValue(value)}. It stays at the front.`;
  return `Peek ${formatValue(value)}. The queue stays ${formatQueue(values)}, front to back, and ${formatValue(frontOf(values))} stays at the front.`;
}

function requireValue(value: number | null): number {
  if (value === null) throw new RangeError("A queue step is missing its value.");
  return value;
}

function frontOf(values: readonly number[]): number {
  const front = values[0];
  if (front === undefined) throw new RangeError("A queue step is missing its front value.");
  return front;
}

function formatValue(value: number | undefined): string {
  if (value === undefined) throw new RangeError("A queue step is missing its value.");
  return String(value);
}

function formatQueue(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}

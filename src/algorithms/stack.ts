export type StackOperation =
  | { readonly op: "push"; readonly value: number }
  | { readonly op: "pop" }
  | { readonly op: "peek" };

export type StackAction = "start" | "push" | "pop" | "peek" | "underflow";

export interface StackStep {
  /** Contents after this step. Index 0 is the bottom and the last index is the top. */
  readonly values: readonly number[];
  readonly action: StackAction;
  /** The operation that produced this step. Null on the opening snapshot. */
  readonly operation: StackOperation | null;
  /** Value pushed, popped, or peeked. Null on the opening snapshot and on underflow. */
  readonly value: number | null;
  readonly message: string;
}

/**
 * Record each push, pop, and peek on a stack.
 * The caller's operations and starting values are copied, and each snapshot
 * is frozen, so later edits do not rewrite old steps. Pop or peek on an
 * empty stack records an underflow and the trace continues.
 */
export function stackSteps(
  operations: readonly StackOperation[],
  initial: readonly number[] = [],
): StackStep[] {
  if (initial.some((value) => !Number.isFinite(value))) {
    throw new RangeError("stackSteps expects finite numbers.");
  }

  const working = initial.slice();
  let values = freeze(working);
  const steps: StackStep[] = [step(values, "start", null, null)];

  for (const operation of operations) {
    const recorded = copyOperation(operation);
    if (recorded.op === "push") {
      working.push(recorded.value);
      values = freeze(working);
      steps.push(step(values, "push", recorded, recorded.value));
      continue;
    }

    if (working.length === 0) {
      steps.push(step(values, "underflow", recorded, null));
      continue;
    }

    const top = working[working.length - 1];
    if (top === undefined) {
      throw new RangeError("Stack index fell outside the contents.");
    }
    if (recorded.op === "peek") {
      steps.push(step(values, "peek", recorded, top));
      continue;
    }

    working.pop();
    values = freeze(working);
    steps.push(step(values, "pop", recorded, top));
  }

  return steps;
}

function copyOperation(operation: StackOperation): StackOperation {
  const record = operation as { op?: unknown; value?: unknown } | null;
  if (record !== null && typeof record === "object") {
    if (record.op === "pop" || record.op === "peek") {
      return Object.freeze({ op: record.op });
    }
    if (record.op === "push") {
      if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
        throw new RangeError("stackSteps expects finite numbers.");
      }
      return Object.freeze({ op: "push", value: record.value });
    }
  }
  throw new RangeError("stackSteps expects push, pop, or peek operations.");
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  action: StackAction,
  operation: StackOperation | null,
  value: number | null,
): StackStep {
  return {
    values,
    action,
    operation,
    value,
    message: describe(values, action, operation, value),
  };
}

function describe(
  values: readonly number[],
  action: StackAction,
  operation: StackOperation | null,
  value: number | null,
): string {
  switch (action) {
    case "start":
      return describeStart(values);
    case "push":
      return describePush(values, requireValue(value));
    case "pop":
      return describePop(values, requireValue(value));
    case "peek":
      return describePeek(values, requireValue(value));
    case "underflow":
      if (operation?.op === "peek") return "Peek an empty stack. There is no top value.";
      if (operation?.op === "pop") return "Pop an empty stack. Nothing comes off.";
      throw new RangeError("An underflow step is missing its operation.");
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected stack action: ${String(unexpected)}`);
    }
  }
}

function describeStart(values: readonly number[]): string {
  if (values.length === 0) return "Start with an empty stack.";
  if (values.length === 1) {
    return `Start with ${formatValue(values[0])} on the stack. It is the top.`;
  }
  return `Start with ${formatStack(values)}, bottom to top. ${formatValue(topOf(values))} is on top.`;
}

function describePush(values: readonly number[], value: number): string {
  if (values.length === 1) return `Push ${formatValue(value)}. It is now the only value, on top.`;
  return `Push ${formatValue(value)}. The stack is now ${formatStack(values)}, bottom to top, and ${formatValue(topOf(values))} is on top.`;
}

function describePop(values: readonly number[], value: number): string {
  if (values.length === 0) return `Pop ${formatValue(value)}. The stack is now empty.`;
  if (values.length === 1) {
    return `Pop ${formatValue(value)}. The stack is now ${formatStack(values)}, and ${formatValue(topOf(values))} is on top.`;
  }
  return `Pop ${formatValue(value)}. The stack is now ${formatStack(values)}, bottom to top, and ${formatValue(topOf(values))} is on top.`;
}

function describePeek(values: readonly number[], value: number): string {
  if (values.length === 1) return `Peek ${formatValue(value)}. It stays on top.`;
  return `Peek ${formatValue(value)}. The stack stays ${formatStack(values)}, bottom to top, and ${formatValue(topOf(values))} stays on top.`;
}

function requireValue(value: number | null): number {
  if (value === null) throw new RangeError("A stack step is missing its value.");
  return value;
}

function topOf(values: readonly number[]): number {
  const top = values[values.length - 1];
  if (top === undefined) throw new RangeError("A stack step is missing its top value.");
  return top;
}

function formatValue(value: number | undefined): string {
  if (value === undefined) throw new RangeError("A stack step is missing its value.");
  return String(value);
}

function formatStack(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}

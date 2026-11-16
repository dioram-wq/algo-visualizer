export type LinkedListOperation =
  | { readonly op: "insert-head"; readonly value: number }
  | { readonly op: "insert-tail"; readonly value: number }
  | { readonly op: "search"; readonly value: number }
  | { readonly op: "delete"; readonly value: number };

export type LinkedListAction =
  | "start"
  | "insert-head"
  | "insert-tail"
  | "search"
  | "delete"
  | "not-found";

export interface LinkedListStep {
  /** Contents after this step. Index 0 is the head and the last index is the tail. */
  readonly values: readonly number[];
  readonly action: LinkedListAction;
  /** The operation that produced this step. Null on the opening snapshot. */
  readonly operation: LinkedListOperation | null;
  /**
   * Value inserted, found, or deleted. On a miss, the value that was sought.
   * Null on the opening snapshot.
   */
  readonly value: number | null;
  /** Index of the node inserted, found, or removed. Null on the opening snapshot and on a miss. */
  readonly index: number | null;
  readonly message: string;
}

/**
 * Record each insert at the head, insert at the tail, search, and delete on a
 * singly linked list. The caller's operations and starting values are copied,
 * and each snapshot is frozen, so later edits do not rewrite old steps.
 * Search and delete walk from the head and use the first match. A search or
 * delete that misses records a not-found step and the trace continues.
 */
export function linkedListSteps(
  operations: readonly LinkedListOperation[],
  initial: readonly number[] = [],
): LinkedListStep[] {
  if (initial.some((value) => !Number.isFinite(value))) {
    throw new RangeError("linkedListSteps expects finite numbers.");
  }

  const working = initial.slice();
  let values = freeze(working);
  const steps: LinkedListStep[] = [step(values, "start", null, null, null)];

  for (const operation of operations) {
    const recorded = copyOperation(operation);
    if (recorded.op === "insert-head") {
      working.unshift(recorded.value);
      values = freeze(working);
      steps.push(step(values, "insert-head", recorded, recorded.value, 0));
      continue;
    }
    if (recorded.op === "insert-tail") {
      working.push(recorded.value);
      values = freeze(working);
      steps.push(step(values, "insert-tail", recorded, recorded.value, working.length - 1));
      continue;
    }

    const found = working.indexOf(recorded.value);
    if (found === -1) {
      steps.push(step(values, "not-found", recorded, recorded.value, null));
      continue;
    }
    if (recorded.op === "search") {
      steps.push(step(values, "search", recorded, recorded.value, found));
      continue;
    }

    working.splice(found, 1);
    values = freeze(working);
    steps.push(step(values, "delete", recorded, recorded.value, found));
  }

  return steps;
}

function copyOperation(operation: LinkedListOperation): LinkedListOperation {
  const record = operation as { op?: unknown; value?: unknown } | null;
  if (record !== null && typeof record === "object") {
    if (
      record.op === "insert-head" ||
      record.op === "insert-tail" ||
      record.op === "search" ||
      record.op === "delete"
    ) {
      if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
        throw new RangeError("linkedListSteps expects finite numbers.");
      }
      return Object.freeze({ op: record.op, value: record.value });
    }
  }
  throw new RangeError(
    "linkedListSteps expects insert-head, insert-tail, search, or delete operations.",
  );
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  action: LinkedListAction,
  operation: LinkedListOperation | null,
  value: number | null,
  index: number | null,
): LinkedListStep {
  return {
    values,
    action,
    operation,
    value,
    index,
    message: describe(values, action, operation, value, index),
  };
}

function describe(
  values: readonly number[],
  action: LinkedListAction,
  operation: LinkedListOperation | null,
  value: number | null,
  index: number | null,
): string {
  switch (action) {
    case "start":
      return describeStart(values);
    case "insert-head":
      return describeInsertHead(values, requireValue(value));
    case "insert-tail":
      return describeInsertTail(values, requireValue(value));
    case "search":
      return describeSearch(values, requireValue(value), requireIndex(index));
    case "delete":
      return describeDelete(values, requireValue(value), requireIndex(index));
    case "not-found":
      return describeNotFound(values, operation);
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected linked list action: ${String(unexpected)}`);
    }
  }
}

function describeStart(values: readonly number[]): string {
  if (values.length === 0) return "Start with an empty list.";
  if (values.length === 1) {
    return `Start with ${formatValue(values[0])} in the list. It is the head.`;
  }
  return `Start with ${formatList(values)}, head to tail. ${formatValue(headOf(values))} is the head.`;
}

function describeInsertHead(values: readonly number[], value: number): string {
  if (values.length === 1) {
    return `Insert ${formatValue(value)} at the head. It is now the only value, and the head.`;
  }
  return `Insert ${formatValue(value)} at the head. The list is now ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} is the head.`;
}

function describeInsertTail(values: readonly number[], value: number): string {
  if (values.length === 1) {
    return `Insert ${formatValue(value)} at the tail. It is now the only value, and the head.`;
  }
  return `Insert ${formatValue(value)} at the tail. The list is now ${formatList(values)}, head to tail, ${formatValue(headOf(values))} is the head, and ${formatValue(value)} is the tail.`;
}

function describeSearch(values: readonly number[], value: number, index: number): string {
  if (values.length === 1) return `Search finds ${formatValue(value)}. It stays the head.`;
  if (index === 0) {
    return `Search finds ${formatValue(value)} at the head. The list stays ${formatList(values)}, head to tail, and ${formatValue(value)} stays the head.`;
  }
  if (index === values.length - 1) {
    return `Search finds ${formatValue(value)} at the tail. The list stays ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} stays the head.`;
  }
  return `Search finds ${formatValue(value)} at index ${index}. The list stays ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} stays the head.`;
}

function describeDelete(values: readonly number[], value: number, index: number): string {
  if (values.length === 0) return `Delete ${formatValue(value)}. The list is now empty.`;
  const place = index === 0 ? "head" : index === values.length ? "tail" : null;
  if (place === "head" && values.length === 1) {
    return `Delete ${formatValue(value)} from the head. The list is now ${formatList(values)}, and ${formatValue(headOf(values))} is the head.`;
  }
  if (place === "head") {
    return `Delete ${formatValue(value)} from the head. The list is now ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} is the head.`;
  }
  if (place === "tail" && values.length === 1) {
    return `Delete ${formatValue(value)} from the tail. The list is now ${formatList(values)}, and ${formatValue(headOf(values))} is the head.`;
  }
  if (place === "tail") {
    return `Delete ${formatValue(value)} from the tail. The list is now ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} is the head.`;
  }
  return `Delete ${formatValue(value)}. The list is now ${formatList(values)}, head to tail, and ${formatValue(headOf(values))} is the head.`;
}

function describeNotFound(
  values: readonly number[],
  operation: LinkedListOperation | null,
): string {
  if (operation?.op === "search") {
    if (values.length === 0) {
      return `Search an empty list for ${formatValue(operation.value)}. It is not there.`;
    }
    return `Search for ${formatValue(operation.value)}. It is not in ${formatList(values)}.`;
  }
  if (operation?.op === "delete") {
    if (values.length === 0) {
      return `Delete ${formatValue(operation.value)} from an empty list. It is not there.`;
    }
    return `Delete ${formatValue(operation.value)}. It is not in ${formatList(values)}.`;
  }
  throw new RangeError("A not-found step is missing its operation.");
}

function requireValue(value: number | null): number {
  if (value === null) throw new RangeError("A linked list step is missing its value.");
  return value;
}

function requireIndex(index: number | null): number {
  if (index === null) throw new RangeError("A linked list step is missing its index.");
  return index;
}

function headOf(values: readonly number[]): number {
  const head = values[0];
  if (head === undefined) throw new RangeError("A linked list step is missing its head.");
  return head;
}

function formatValue(value: number | undefined): string {
  if (value === undefined) throw new RangeError("A linked list step is missing its value.");
  return String(value);
}

function formatList(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}

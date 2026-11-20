export type HeapOperation =
  | { readonly op: "insert"; readonly value: number }
  | { readonly op: "extract-min" }
  | { readonly op: "peek" };

export type HeapAction =
  | "start"
  | "insert"
  | "compare"
  | "swap"
  | "extract-min"
  | "last-to-root"
  | "peek"
  | "underflow";

/** Comparison of the value at `index` with the value at `other`. */
export type HeapRelation = "less" | "greater" | "equal";

/**
 * What a compare or swap is measured against.
 * "parent" while sifting up, "child" while sifting down against one child,
 * and "children" while choosing the smaller of the two children.
 */
export type HeapAgainst = "parent" | "child" | "children";

export interface HeapStep {
  /** Heap array as it stands at this step. Index 0 is the root. */
  readonly values: readonly number[];
  readonly action: HeapAction;
  /** The operation that produced this step. Null on the opening snapshot. */
  readonly operation: HeapOperation | null;
  /**
   * Inserted value, removed root, or peeked root.
   * On a compare or swap, the value at `index`: the child sifting up, the
   * parent sifting down, or the left child when the two children are compared.
   * Null on the opening snapshot and on underflow.
   */
  readonly value: number | null;
  /**
   * Index of `value` after this step.
   * Insert appends at the end. Extract-min and peek name the root.
   * A swap names where the moving value landed. A comparison of two children
   * names the left child. Null on the opening snapshot and on underflow.
   */
  readonly index: number | null;
  /**
   * The other index of a comparison or swap: the parent while sifting up,
   * the child while sifting down, or the right child when choosing between
   * children. On a swap this is the index the moving value left. On
   * last-to-root it is the index the last value moved from, which is no
   * longer in the array. Null otherwise.
   */
  readonly other: number | null;
  /** Set on compare steps only. */
  readonly relation: HeapRelation | null;
  /** Set on compare and swap steps only. */
  readonly against: HeapAgainst | null;
  readonly message: string;
}

/**
 * Record a binary min-heap as values are inserted, extracted, and peeked.
 * The heap is an array. Index 0 is the root, the parent of index i is
 * floor((i - 1) / 2), and its children are 2i + 1 and 2i + 2. A parent is
 * less than or equal to both children.
 *
 * The caller's operations and starting values are copied, and each snapshot
 * is frozen, so later edits do not rewrite old steps. The starting array
 * must already be a min-heap.
 *
 * Insert appends the value, then sifts it up while it is strictly less than
 * its parent. Extract-min removes the root. When the heap had more than one
 * value, the last value moves to the root and sifts down. Sift-down compares
 * the children when both exist, chooses the smaller (the left when they are
 * equal), and swaps the parent down while it is strictly greater than that
 * child. Peek reads the root and leaves the heap as it was. Extract-min or
 * peek on an empty heap records an underflow and the trace continues.
 * Equal values do not swap.
 */
export function heapSteps(
  operations: readonly HeapOperation[],
  initial: readonly number[] = [],
): HeapStep[] {
  if (initial.some((value) => !Number.isFinite(value))) {
    throw new RangeError("heapSteps expects finite numbers.");
  }
  assertMinHeap(initial);

  const working = initial.slice();
  let values = freeze(working);
  const steps: HeapStep[] = [step(values, "start", null, null, null, null, null, null)];

  for (const operation of operations) {
    const recorded = copyOperation(operation);
    if (recorded.op === "insert") insertValue(recorded);
    else if (recorded.op === "extract-min") extractMin(recorded);
    else peekValue(recorded);
  }

  return steps;

  function insertValue(operation: HeapOperation & { op: "insert" }): void {
    working.push(operation.value);
    values = freeze(working);
    const index = working.length - 1;
    steps.push(step(values, "insert", operation, operation.value, index, null, null, null));
    siftUp(operation, index);
  }

  function extractMin(operation: HeapOperation & { op: "extract-min" }): void {
    if (working.length === 0) {
      steps.push(step(values, "underflow", operation, null, null, null, null, null));
      return;
    }

    const root = at(working, 0);
    if (working.length === 1) {
      working.pop();
      values = freeze(working);
      steps.push(step(values, "extract-min", operation, root, 0, null, null, null));
      return;
    }

    const lastIndex = working.length - 1;
    const last = at(working, lastIndex);
    steps.push(step(values, "extract-min", operation, root, 0, null, null, null));
    working[0] = last;
    working.pop();
    values = freeze(working);
    steps.push(step(values, "last-to-root", operation, last, 0, lastIndex, null, null));
    siftDown(operation, 0);
  }

  function peekValue(operation: HeapOperation & { op: "peek" }): void {
    if (working.length === 0) {
      steps.push(step(values, "underflow", operation, null, null, null, null, null));
      return;
    }
    steps.push(step(values, "peek", operation, at(working, 0), 0, null, null, null));
  }

  function siftUp(operation: HeapOperation, index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const childValue = at(working, index);
      const parentValue = at(working, parent);
      const relation = relate(childValue, parentValue);
      steps.push(step(values, "compare", operation, childValue, index, parent, relation, "parent"));
      if (relation !== "less") return;

      working[index] = parentValue;
      working[parent] = childValue;
      values = freeze(working);
      steps.push(step(values, "swap", operation, childValue, parent, index, null, "parent"));
      index = parent;
    }
  }

  function siftDown(operation: HeapOperation, index: number): void {
    while (true) {
      const left = index * 2 + 1;
      if (left >= working.length) return;
      const right = left + 1;

      let child = left;
      if (right < working.length) {
        const leftValue = at(working, left);
        const rightValue = at(working, right);
        const between = relate(leftValue, rightValue);
        steps.push(step(values, "compare", operation, leftValue, left, right, between, "children"));
        if (between === "greater") child = right;
      }

      const parentValue = at(working, index);
      const childValue = at(working, child);
      const relation = relate(parentValue, childValue);
      steps.push(step(values, "compare", operation, parentValue, index, child, relation, "child"));
      if (relation !== "greater") return;

      working[index] = childValue;
      working[child] = parentValue;
      values = freeze(working);
      steps.push(step(values, "swap", operation, parentValue, child, index, null, "child"));
      index = child;
    }
  }
}

function assertMinHeap(values: readonly number[]): void {
  for (let index = 1; index < values.length; index += 1) {
    const parent = Math.floor((index - 1) / 2);
    if (at(values, parent) > at(values, index)) {
      throw new RangeError("heapSteps expects the starting array to be a min-heap.");
    }
  }
}

function copyOperation(operation: HeapOperation): HeapOperation {
  const record = operation as { op?: unknown; value?: unknown } | null;
  if (record !== null && typeof record === "object") {
    if (record.op === "extract-min" || record.op === "peek") {
      return Object.freeze({ op: record.op });
    }
    if (record.op === "insert") {
      if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
        throw new RangeError("heapSteps expects finite numbers.");
      }
      return Object.freeze({ op: "insert", value: record.value });
    }
  }
  throw new RangeError("heapSteps expects insert, extract-min, or peek operations.");
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function relate(left: number, right: number): HeapRelation {
  if (left < right) return "less";
  if (left > right) return "greater";
  return "equal";
}

function at(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) throw new RangeError("Heap index fell outside the array.");
  return value;
}

function step(
  values: readonly number[],
  action: HeapAction,
  operation: HeapOperation | null,
  value: number | null,
  index: number | null,
  other: number | null,
  relation: HeapRelation | null,
  against: HeapAgainst | null,
): HeapStep {
  return {
    values,
    action,
    operation,
    value,
    index,
    other,
    relation,
    against,
    message: describe(values, action, operation, value, index, other, relation, against),
  };
}

function describe(
  values: readonly number[],
  action: HeapAction,
  operation: HeapOperation | null,
  value: number | null,
  index: number | null,
  other: number | null,
  relation: HeapRelation | null,
  against: HeapAgainst | null,
): string {
  switch (action) {
    case "start":
      return describeStart(values);
    case "insert":
      return describeInsert(values, requireValue(value), requireIndex(index));
    case "compare":
      return describeCompare(
        values,
        requireValue(value),
        requireIndex(index),
        requireIndex(other),
        requireRelation(relation),
        requireAgainst(against),
      );
    case "swap":
      return describeSwap(
        values,
        requireValue(value),
        requireIndex(index),
        requireIndex(other),
        requireAgainst(against),
      );
    case "extract-min":
      return describeExtract(values, requireValue(value));
    case "last-to-root":
      return describeLastToRoot(values, requireValue(value), requireIndex(other));
    case "peek":
      return describePeek(values, requireValue(value));
    case "underflow":
      return describeUnderflow(values, operation);
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected heap action: ${String(unexpected)}`);
    }
  }
}

function describeStart(values: readonly number[]): string {
  if (values.length === 0) return "Start with an empty heap.";
  if (values.length === 1) {
    return `Start with ${formatValue(at(values, 0))} in the heap. It is the root.`;
  }
  return `Start with ${formatHeap(values)}, in heap order. ${formatValue(at(values, 0))} is the root.`;
}

function describeInsert(values: readonly number[], value: number, index: number): string {
  if (index !== values.length - 1 || at(values, index) !== value) {
    throw new RangeError("An insert step does not append its value.");
  }
  const inserted = formatValue(value);
  if (values.length === 1) return `Insert ${inserted}. It is now the only value, at the root.`;
  return `Insert ${inserted} at index ${index}. The heap is now ${formatHeap(values)}.`;
}

function describeCompare(
  values: readonly number[],
  value: number,
  index: number,
  other: number,
  relation: HeapRelation,
  against: HeapAgainst,
): string {
  const here = at(values, index);
  const there = at(values, other);
  if (here !== value) throw new RangeError("A comparison step does not match its value.");
  if (relate(here, there) !== relation) {
    throw new RangeError("A comparison step does not match its values.");
  }
  if (against === "parent") {
    if (Math.floor((index - 1) / 2) !== other) {
      throw new RangeError("A sift-up comparison is not with the parent.");
    }
    return describeSiftUpCompare(value, index, there, other, relation);
  }
  if (against === "child") {
    if (other !== index * 2 + 1 && other !== index * 2 + 2) {
      throw new RangeError("A sift-down comparison is not with a child.");
    }
    return describeSiftDownCompare(value, index, there, other, relation);
  }
  if (against === "children") {
    return describeChildren(value, index, there, other, relation);
  }
  const unexpected: never = against;
  throw new Error(`Unexpected heap comparison: ${String(unexpected)}`);
}

function describeSiftUpCompare(
  value: number,
  index: number,
  parent: number,
  parentIndex: number,
  relation: HeapRelation,
): string {
  const child = formatValue(value);
  const above = formatValue(parent);
  const lead = `Compare ${child} at index ${index} with its parent ${above} at index ${parentIndex}.`;
  if (relation === "less") return `${lead} ${child} is less than ${above}, so it swaps upward.`;
  if (relation === "greater") return `${lead} ${child} is greater than ${above}, so it stays.`;
  return `${lead} The values are equal, so ${child} stays.`;
}

function describeSiftDownCompare(
  value: number,
  index: number,
  child: number,
  childIndex: number,
  relation: HeapRelation,
): string {
  const parent = formatValue(value);
  const below = formatValue(child);
  const lead = `Compare ${parent} at index ${index} with its child ${below} at index ${childIndex}.`;
  if (relation === "greater") return `${lead} ${parent} is greater than ${below}, so it swaps downward.`;
  if (relation === "less") return `${lead} ${parent} is less than ${below}, so it stays.`;
  return `${lead} The values are equal, so ${parent} stays.`;
}

function describeChildren(
  left: number,
  leftIndex: number,
  right: number,
  rightIndex: number,
  relation: HeapRelation,
): string {
  const parent = Math.floor((leftIndex - 1) / 2);
  if (leftIndex !== parent * 2 + 1 || rightIndex !== parent * 2 + 2) {
    throw new RangeError("A children comparison is not a sibling pair.");
  }
  const leftText = formatValue(left);
  const rightText = formatValue(right);
  const lead = `Compare the children of index ${parent}. Index ${leftIndex} holds ${leftText} and index ${rightIndex} holds ${rightText}.`;
  if (relation === "less") {
    return `${lead} ${leftText} is smaller, so the sift looks at index ${leftIndex}.`;
  }
  if (relation === "greater") {
    return `${lead} ${rightText} is smaller, so the sift looks at index ${rightIndex}.`;
  }
  return `${lead} They are equal, so the sift looks at the left child, index ${leftIndex}.`;
}

function describeSwap(
  values: readonly number[],
  value: number,
  index: number,
  other: number,
  against: HeapAgainst,
): string {
  if (at(values, index) !== value) throw new RangeError("A swap step does not match its value.");
  const moved = formatValue(value);
  const heap = formatHeap(values);
  if (against === "parent") {
    if (Math.floor((other - 1) / 2) !== index) {
      throw new RangeError("A sift-up swap does not move to the parent.");
    }
    if (index === 0) {
      return `Swap index ${other} and index ${index}. ${moved} moves up to the root. The heap is now ${heap}.`;
    }
    return `Swap index ${other} and index ${index}. ${moved} moves up to index ${index}. The heap is now ${heap}.`;
  }
  if (against === "child") {
    if (index !== other * 2 + 1 && index !== other * 2 + 2) {
      throw new RangeError("A sift-down swap does not move to a child.");
    }
    if (index * 2 + 1 >= values.length) {
      return `Swap index ${other} and index ${index}. ${moved} moves down to index ${index}, which has no children, so the sift stops. The heap is now ${heap}.`;
    }
    return `Swap index ${other} and index ${index}. ${moved} moves down to index ${index}. The heap is now ${heap}.`;
  }
  throw new RangeError("A swap step is missing its direction.");
}

function describeExtract(values: readonly number[], value: number): string {
  const extracted = formatValue(value);
  if (values.length === 0) {
    return `Extract the minimum ${extracted}. It was the only value, so the heap is now empty.`;
  }
  if (at(values, 0) !== value) {
    throw new RangeError("An extract-min step does not show the root it removes.");
  }
  return `Extract the minimum ${extracted} from the root.`;
}

function describeLastToRoot(values: readonly number[], value: number, from: number): string {
  if (values.length === 0 || at(values, 0) !== value) {
    throw new RangeError("A last-to-root step does not land on the root.");
  }
  if (from !== values.length) {
    throw new RangeError("A last-to-root step does not name the index it left.");
  }
  const moved = formatValue(value);
  const heap = formatHeap(values);
  if (values.length === 1) {
    return `Move ${moved} from index ${from} to the root. It has no children, so the sift stops. The heap is now ${heap}.`;
  }
  return `Move ${moved} from index ${from} to the root. The heap is now ${heap}.`;
}

function describePeek(values: readonly number[], value: number): string {
  if (values.length === 0 || at(values, 0) !== value) {
    throw new RangeError("A peek step does not show the root.");
  }
  const peeked = formatValue(value);
  if (values.length === 1) return `Peek ${peeked}. It stays at the root.`;
  return `Peek ${peeked}. The heap stays ${formatHeap(values)}, and ${peeked} stays at the root.`;
}

function describeUnderflow(values: readonly number[], operation: HeapOperation | null): string {
  if (values.length !== 0) throw new RangeError("An underflow step is not an empty heap.");
  if (operation?.op === "peek") return "Peek an empty heap. There is no root.";
  if (operation?.op === "extract-min") return "Extract the minimum of an empty heap. There is no root.";
  throw new RangeError("An underflow step is missing its operation.");
}

function requireValue(value: number | null): number {
  if (value === null) throw new RangeError("A heap step is missing its value.");
  return value;
}

function requireIndex(index: number | null): number {
  if (index === null) throw new RangeError("A heap step is missing its index.");
  return index;
}

function requireRelation(relation: HeapRelation | null): HeapRelation {
  if (relation === null) throw new RangeError("A comparison step is missing its result.");
  return relation;
}

function requireAgainst(against: HeapAgainst | null): HeapAgainst {
  if (against === null) throw new RangeError("A heap step is missing its direction.");
  return against;
}

function formatValue(value: number): string {
  return String(value);
}

function formatHeap(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}

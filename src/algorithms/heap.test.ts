import { describe, expect, it } from "vitest";
import { heapSteps, type HeapOperation, type HeapStep } from "./heap.ts";

function outline(steps: readonly HeapStep[]) {
  return steps.map((current) => ({
    action: current.action,
    values: [...current.values],
    operation:
      current.operation === null
        ? null
        : current.operation.op === "insert"
          ? { op: current.operation.op, value: current.operation.value }
          : { op: current.operation.op },
    value: current.value,
    index: current.index,
    other: current.other,
    relation: current.relation,
    against: current.against,
    message: current.message,
  }));
}

function row(
  action: HeapStep["action"],
  values: readonly number[],
  operation: HeapOperation | null,
  value: number | null,
  index: number | null,
  other: number | null,
  relation: HeapStep["relation"],
  against: HeapStep["against"],
  message: string,
) {
  return {
    action,
    values: [...values],
    operation,
    value,
    index,
    other,
    relation,
    against,
    message,
  };
}

function insert(value: number): HeapOperation {
  return { op: "insert", value };
}

const extractMin: HeapOperation = { op: "extract-min" };
const peek: HeapOperation = { op: "peek" };

function isMinHeap(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const parent = values[Math.floor((index - 1) / 2)];
    const value = values[index];
    if (parent === undefined || value === undefined || parent > value) return false;
  }
  return true;
}

function sorted(values: readonly number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function settledOf(steps: readonly HeapStep[]): number[][] {
  const settled: number[][] = [];
  let operation: HeapOperation | null = null;
  let last: HeapStep | null = null;
  const pushLast = () => {
    if (last !== null) settled.push([...last.values]);
  };
  for (const current of steps) {
    if (current.action === "start") {
      settled.push([...current.values]);
      continue;
    }
    if (current.operation !== operation) {
      pushLast();
      operation = current.operation;
    }
    last = current;
  }
  pushLast();
  return settled;
}

function readsOf(steps: readonly HeapStep[]): (number | null)[] {
  const reads: (number | null)[] = [];
  for (const current of steps) {
    if (
      current.action === "extract-min" ||
      current.action === "peek" ||
      current.action === "underflow"
    ) {
      reads.push(current.value);
    }
  }
  return reads;
}

/** The heap after the opening snapshot and after each operation has finished sifting. */
function expectHeapAfterEveryOperation(
  steps: readonly HeapStep[],
  operations: readonly HeapOperation[],
  initial: readonly number[],
): void {
  const settled = settledOf(steps);
  expect(settled).toHaveLength(operations.length + 1);
  expect(settled[0]).toEqual([...initial]);
  const reads = readsOf(steps);
  let readIndex = 0;
  for (let index = 0; index < operations.length; index += 1) {
    const before = settled[index];
    const after = settled[index + 1];
    const operation = operations[index];
    if (before === undefined || after === undefined || operation === undefined) {
      throw new Error("The trace is missing a settled heap.");
    }
    expect(isMinHeap(before)).toBe(true);
    expect(isMinHeap(after)).toBe(true);
    if (operation.op === "insert") {
      expect(sorted(after)).toEqual(sorted([...before, operation.value]));
      continue;
    }
    const read = reads[readIndex];
    readIndex += 1;
    if (before.length === 0) {
      expect(read).toBeNull();
      expect(after).toEqual([]);
      continue;
    }
    const minimum = Math.min(...before);
    if (operation.op === "peek") {
      expect(read).toBe(minimum);
      expect(after).toEqual(before);
      continue;
    }
    expect(read).toBe(minimum);
    const withoutMin = before.filter((_value, position) => position !== 0);
    expect(sorted(after)).toEqual(sorted(withoutMin));
  }
  expect(readIndex).toBe(reads.length);
}

function parentOf(index: number): number {
  return Math.floor((index - 1) / 2);
}

function relationOf(left: number, right: number): HeapStep["relation"] {
  if (left < right) return "less";
  if (left > right) return "greater";
  return "equal";
}

function numberAt(values: readonly number[], index: number): number {
  const value = values[index];
  expect(value).not.toBeUndefined();
  if (value === undefined) throw new Error("Missing heap value.");
  return value;
}

function requireStepNumber(value: number | null): number {
  expect(value).not.toBeNull();
  if (value === null) throw new Error("Missing step number.");
  return value;
}

function expectConsistent(steps: readonly HeapStep[], operations: readonly HeapOperation[]): void {
  expect(steps.length).toBeGreaterThan(0);
  const opening = steps[0];
  if (opening === undefined) throw new Error("Missing opening step.");
  expect(opening.action).toBe("start");
  expect(opening.operation).toBeNull();
  expect(opening.value).toBeNull();
  expect(opening.index).toBeNull();
  expect(opening.other).toBeNull();
  expect(opening.relation).toBeNull();
  expect(opening.against).toBeNull();
  expect(Object.isFrozen(opening.values)).toBe(true);
  expect(opening.message.length).toBeGreaterThan(0);

  const seen: HeapOperation[] = [];
  let group: HeapStep[] = [];
  let previous = opening;

  const finishGroup = () => {
    if (group.length === 0) return;
    const first = group[0];
    if (first === undefined) throw new Error("Missing group step.");
    for (const current of group) expect(current.operation).toBe(first.operation);
    const operation = first.operation;
    if (operation === null) throw new Error("A step is missing its operation.");
    if (operation.op === "insert") expectInsertGroup(group);
    else if (operation.op === "peek") expectPeekGroup(group);
    else expectExtractGroup(group);
    group = [];
  };

  for (const current of steps.slice(1)) {
    expect(current.operation).not.toBeNull();
    expect(Object.isFrozen(current.values)).toBe(true);
    expect(Object.isFrozen(current.operation)).toBe(true);
    expect(current.message.length).toBeGreaterThan(0);
    if (current.operation !== previous.operation) {
      finishGroup();
      if (current.operation !== null) seen.push(current.operation);
    }
    expectTransition(previous, current);
    group.push(current);
    previous = current;
  }
  finishGroup();
  expect(seen.map(simplify)).toEqual(operations.map(simplify));
}

function simplify(operation: HeapOperation) {
  return operation.op === "insert"
    ? { op: operation.op, value: operation.value }
    : { op: operation.op };
}

function expectInsertGroup(group: readonly HeapStep[]): void {
  const placed = group[0];
  if (placed === undefined) throw new Error("Missing insert step.");
  expect(placed.action).toBe("insert");
  let cursor = requireStepNumber(placed.index);
  expect(cursor).toBe(placed.values.length - 1);
  if (cursor === 0) expect(group).toHaveLength(1);
  else expect(group[1]?.action).toBe("compare");

  for (let index = 1; index < group.length; index += 1) {
    const current = group[index];
    if (current === undefined) throw new Error("Missing sift-up step.");
    expect(current.against).toBe("parent");
    if (current.action === "compare") {
      expect(current.index).toBe(cursor);
      if (current.relation === "less") expect(group[index + 1]?.action).toBe("swap");
      else expect(index).toBe(group.length - 1);
      continue;
    }
    expect(current.action).toBe("swap");
    expect(current.other).toBe(cursor);
    cursor = requireStepNumber(current.index);
    if (cursor === 0) expect(index).toBe(group.length - 1);
    else expect(group[index + 1]?.action).toBe("compare");
  }
  expect(numberAt(group[group.length - 1]?.values ?? [], cursor)).toBe(placed.value);
}

function expectPeekGroup(group: readonly HeapStep[]): void {
  expect(group).toHaveLength(1);
  const only = group[0];
  if (only === undefined) throw new Error("Missing peek step.");
  expect(["peek", "underflow"]).toContain(only.action);
  if (only.action === "peek") expect(only.value).toBe(numberAt(only.values, 0));
}

function expectExtractGroup(group: readonly HeapStep[]): void {
  const removed = group[0];
  if (removed === undefined) throw new Error("Missing extract step.");
  if (removed.action === "underflow") {
    expect(group).toHaveLength(1);
    return;
  }
  expect(removed.action).toBe("extract-min");
  if (group.length === 1) {
    expect(removed.values).toEqual([]);
    return;
  }
  expect(group[1]?.action).toBe("last-to-root");
  const landed = group[1];
  if (landed === undefined) throw new Error("Missing last-to-root step.");
  if (landed.values.length === 1) {
    expect(group).toHaveLength(2);
    return;
  }
  expect(group.length).toBeGreaterThan(2);
  let cursor = 0;
  for (let index = 2; index < group.length; index += 1) {
    const current = group[index];
    if (current === undefined) throw new Error("Missing sift-down step.");
    if (current.action === "compare" && current.against === "children") {
      const left = requireStepNumber(current.index);
      const right = requireStepNumber(current.other);
      expect(left).toBe(cursor * 2 + 1);
      expect(right).toBe(cursor * 2 + 2);
      const chosen = current.relation === "greater" ? right : left;
      expect(group[index + 1]?.action).toBe("compare");
      expect(group[index + 1]?.against).toBe("child");
      expect(group[index + 1]?.other).toBe(chosen);
      continue;
    }
    if (current.action === "compare" && current.against === "child") {
      expect(current.index).toBe(cursor);
      const right = cursor * 2 + 2;
      if (right < current.values.length) expect(group[index - 1]?.against).toBe("children");
      else {
        expect(group[index - 1]?.against).not.toBe("children");
        expect(current.other).toBe(cursor * 2 + 1);
      }
      if (current.relation === "greater") expect(group[index + 1]?.action).toBe("swap");
      else expect(index).toBe(group.length - 1);
      continue;
    }
    expect(current.action).toBe("swap");
    expect(current.against).toBe("child");
    expect(current.other).toBe(cursor);
    cursor = requireStepNumber(current.index);
    const hasChild = cursor * 2 + 1 < current.values.length;
    if (hasChild) expect(group[index + 1]?.action).toBe("compare");
    else expect(index).toBe(group.length - 1);
  }
}

function expectTransition(previous: HeapStep, current: HeapStep): void {
  if (current.action === "insert") {
    expect(current.values).not.toBe(previous.values);
    expect(current.values.length).toBe(previous.values.length + 1);
    const index = requireStepNumber(current.index);
    expect(index).toBe(current.values.length - 1);
    expect(current.value).toBe(numberAt(current.values, index));
    expect([...current.values].slice(0, -1)).toEqual([...previous.values]);
    expect(current.other).toBeNull();
    expect(current.relation).toBeNull();
    expect(current.against).toBeNull();
    return;
  }
  if (current.action === "compare") {
    expect(current.values).toBe(previous.values);
    const index = requireStepNumber(current.index);
    const other = requireStepNumber(current.other);
    const here = numberAt(current.values, index);
    const there = numberAt(current.values, other);
    expect(current.value).toBe(here);
    expect(current.relation).toBe(relationOf(here, there));
    if (current.against === "parent") expect(parentOf(index)).toBe(other);
    else if (current.against === "child") {
      expect(other === index * 2 + 1 || other === index * 2 + 2).toBe(true);
    } else if (current.against === "children") {
      expect(other).toBe(index + 1);
      expect(index % 2).toBe(1);
      expect(parentOf(index)).toBe(parentOf(other));
    } else {
      throw new Error("A comparison is missing its direction.");
    }
    return;
  }
  if (current.action === "swap") {
    expect(current.values).not.toBe(previous.values);
    expect(current.values.length).toBe(previous.values.length);
    expect(current.relation).toBeNull();
    const index = requireStepNumber(current.index);
    const other = requireStepNumber(current.other);
    expect(current.value).toBe(numberAt(current.values, index));
    expect(numberAt(current.values, index)).toBe(numberAt(previous.values, other));
    expect(numberAt(current.values, other)).toBe(numberAt(previous.values, index));
    for (let cursor = 0; cursor < current.values.length; cursor += 1) {
      if (cursor !== index && cursor !== other) {
        expect(current.values[cursor]).toBe(previous.values[cursor]);
      }
    }
    expect(previous.action).toBe("compare");
    if (current.against === "parent") {
      expect(parentOf(other)).toBe(index);
      expect(previous.relation).toBe("less");
      expect(previous.against).toBe("parent");
      expect(previous.index).toBe(other);
      expect(previous.other).toBe(index);
      return;
    }
    expect(current.against).toBe("child");
    expect(index === other * 2 + 1 || index === other * 2 + 2).toBe(true);
    expect(previous.relation).toBe("greater");
    expect(previous.against).toBe("child");
    expect(previous.index).toBe(other);
    expect(previous.other).toBe(index);
    return;
  }
  if (current.action === "extract-min") {
    expect(current.index).toBe(0);
    expect(current.other).toBeNull();
    expect(current.relation).toBeNull();
    expect(current.against).toBeNull();
    if (current.values.length === 0) {
      expect(previous.values).toEqual([current.value]);
      expect(current.values).not.toBe(previous.values);
      return;
    }
    expect(current.values).toBe(previous.values);
    expect(current.values.length).toBeGreaterThan(1);
    expect(current.value).toBe(numberAt(current.values, 0));
    return;
  }
  if (current.action === "last-to-root") {
    expect(previous.action).toBe("extract-min");
    expect(current.values.length).toBe(previous.values.length - 1);
    expect(current.index).toBe(0);
    expect(current.other).toBe(previous.values.length - 1);
    expect(current.relation).toBeNull();
    expect(current.against).toBeNull();
    expect(current.value).toBe(numberAt(current.values, 0));
    expect(current.value).toBe(numberAt(previous.values, previous.values.length - 1));
    for (let index = 1; index < current.values.length; index += 1) {
      expect(current.values[index]).toBe(previous.values[index]);
    }
    return;
  }
  if (current.action === "peek") {
    expect(current.values).toBe(previous.values);
    expect(current.index).toBe(0);
    expect(current.value).toBe(numberAt(current.values, 0));
    expect(current.other).toBeNull();
    expect(current.relation).toBeNull();
    expect(current.against).toBeNull();
    return;
  }
  expect(current.action).toBe("underflow");
  expect(previous.values.length).toBe(0);
  expect(current.values).toBe(previous.values);
  expect(current.value).toBeNull();
  expect(current.index).toBeNull();
  expect(current.other).toBeNull();
  expect(current.relation).toBeNull();
  expect(current.against).toBeNull();
  expect(current.operation?.op === "peek" || current.operation?.op === "extract-min").toBe(true);
}

interface DirectHeap {
  settled: number[][];
  reads: (number | null)[];
}

function reference(operations: readonly HeapOperation[], initial: readonly number[]): DirectHeap {
  const heap = initial.slice();
  if (!isMinHeap(heap)) throw new Error("The oracle was given a broken heap.");
  const settled = [heap.slice()];
  const reads: (number | null)[] = [];
  for (const operation of operations) {
    if (operation.op === "insert") {
      heap.push(operation.value);
      siftUp(heap, heap.length - 1);
    } else if (heap.length === 0) {
      reads.push(null);
    } else if (operation.op === "peek") {
      reads.push(numberAt(heap, 0));
    } else if (heap.length === 1) {
      const only = heap.pop();
      if (only === undefined) throw new Error("The oracle lost the only value.");
      reads.push(only);
    } else {
      const minimum = numberAt(heap, 0);
      const last = heap.pop();
      if (last === undefined) throw new Error("The oracle lost the last value.");
      heap[0] = last;
      siftDown(heap, 0);
      reads.push(minimum);
    }
    if (!isMinHeap(heap)) throw new Error("The oracle broke the heap.");
    settled.push(heap.slice());
  }
  return { settled, reads };
}

function siftUp(heap: number[], index: number): void {
  while (index > 0) {
    const parent = parentOf(index);
    const child = numberAt(heap, index);
    const parentValue = numberAt(heap, parent);
    if (child >= parentValue) return;
    heap[index] = parentValue;
    heap[parent] = child;
    index = parent;
  }
}

function siftDown(heap: number[], index: number): void {
  while (true) {
    const left = index * 2 + 1;
    if (left >= heap.length) return;
    let child = left;
    const right = left + 1;
    if (right < heap.length && numberAt(heap, right) < numberAt(heap, left)) child = right;
    const parentValue = numberAt(heap, index);
    const childValue = numberAt(heap, child);
    if (parentValue <= childValue) return;
    heap[index] = childValue;
    heap[child] = parentValue;
    index = child;
  }
}

function script(seed: number, length: number): HeapOperation[] {
  let state = seed >>> 0;
  const operations: HeapOperation[] = [];
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const roll = state % 5;
    if (roll <= 2) operations.push({ op: "insert", value: (state % 13) - 6 });
    else if (roll === 3) operations.push({ op: "peek" });
    else operations.push({ op: "extract-min" });
  }
  return operations;
}

describe("heapSteps", () => {
  it("sifts an inserted value up while it is smaller than its parent", () => {
    const operations = [insert(5), insert(3), insert(4), insert(1)];
    const steps = heapSteps(operations);

    expect(outline(steps)).toEqual([
      row("start", [], null, null, null, null, null, null, "Start with an empty heap."),
      row(
        "insert",
        [5],
        insert(5),
        5,
        0,
        null,
        null,
        null,
        "Insert 5. It is now the only value, at the root.",
      ),
      row(
        "insert",
        [5, 3],
        insert(3),
        3,
        1,
        null,
        null,
        null,
        "Insert 3 at index 1. The heap is now [5, 3].",
      ),
      row(
        "compare",
        [5, 3],
        insert(3),
        3,
        1,
        0,
        "less",
        "parent",
        "Compare 3 at index 1 with its parent 5 at index 0. 3 is less than 5, so it swaps upward.",
      ),
      row(
        "swap",
        [3, 5],
        insert(3),
        3,
        0,
        1,
        null,
        "parent",
        "Swap index 1 and index 0. 3 moves up to the root. The heap is now [3, 5].",
      ),
      row(
        "insert",
        [3, 5, 4],
        insert(4),
        4,
        2,
        null,
        null,
        null,
        "Insert 4 at index 2. The heap is now [3, 5, 4].",
      ),
      row(
        "compare",
        [3, 5, 4],
        insert(4),
        4,
        2,
        0,
        "greater",
        "parent",
        "Compare 4 at index 2 with its parent 3 at index 0. 4 is greater than 3, so it stays.",
      ),
      row(
        "insert",
        [3, 5, 4, 1],
        insert(1),
        1,
        3,
        null,
        null,
        null,
        "Insert 1 at index 3. The heap is now [3, 5, 4, 1].",
      ),
      row(
        "compare",
        [3, 5, 4, 1],
        insert(1),
        1,
        3,
        1,
        "less",
        "parent",
        "Compare 1 at index 3 with its parent 5 at index 1. 1 is less than 5, so it swaps upward.",
      ),
      row(
        "swap",
        [3, 1, 4, 5],
        insert(1),
        1,
        1,
        3,
        null,
        "parent",
        "Swap index 3 and index 1. 1 moves up to index 1. The heap is now [3, 1, 4, 5].",
      ),
      row(
        "compare",
        [3, 1, 4, 5],
        insert(1),
        1,
        1,
        0,
        "less",
        "parent",
        "Compare 1 at index 1 with its parent 3 at index 0. 1 is less than 3, so it swaps upward.",
      ),
      row(
        "swap",
        [1, 3, 4, 5],
        insert(1),
        1,
        0,
        1,
        null,
        "parent",
        "Swap index 1 and index 0. 1 moves up to the root. The heap is now [1, 3, 4, 5].",
      ),
    ]);
    expect(steps[3]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).not.toBe(steps[3]?.values);
    expect(steps[6]?.values).toBe(steps[5]?.values);
    expect(steps[8]?.values).toBe(steps[7]?.values);
    expect(steps[10]?.values).toBe(steps[9]?.values);
    expect(steps[2]?.operation).toBe(steps[4]?.operation);
    expect(steps[2]?.operation).not.toBe(steps[5]?.operation);
    expectHeapAfterEveryOperation(steps, operations, []);
    expectConsistent(steps, operations);
    expect(settledOf(steps)).toEqual(reference(operations, []).settled);
  });

  it("sifts an inserted value through several parents", () => {
    const initial = [3, 5, 6, 8, 9, 10, 7];
    const operations = [insert(1)];
    const steps = heapSteps(operations, initial);

    expect(outline(steps)).toEqual([
      row(
        "start",
        initial,
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [3, 5, 6, 8, 9, 10, 7], in heap order. 3 is the root.",
      ),
      row(
        "insert",
        [3, 5, 6, 8, 9, 10, 7, 1],
        insert(1),
        1,
        7,
        null,
        null,
        null,
        "Insert 1 at index 7. The heap is now [3, 5, 6, 8, 9, 10, 7, 1].",
      ),
      row(
        "compare",
        [3, 5, 6, 8, 9, 10, 7, 1],
        insert(1),
        1,
        7,
        3,
        "less",
        "parent",
        "Compare 1 at index 7 with its parent 8 at index 3. 1 is less than 8, so it swaps upward.",
      ),
      row(
        "swap",
        [3, 5, 6, 1, 9, 10, 7, 8],
        insert(1),
        1,
        3,
        7,
        null,
        "parent",
        "Swap index 7 and index 3. 1 moves up to index 3. The heap is now [3, 5, 6, 1, 9, 10, 7, 8].",
      ),
      row(
        "compare",
        [3, 5, 6, 1, 9, 10, 7, 8],
        insert(1),
        1,
        3,
        1,
        "less",
        "parent",
        "Compare 1 at index 3 with its parent 5 at index 1. 1 is less than 5, so it swaps upward.",
      ),
      row(
        "swap",
        [3, 1, 6, 5, 9, 10, 7, 8],
        insert(1),
        1,
        1,
        3,
        null,
        "parent",
        "Swap index 3 and index 1. 1 moves up to index 1. The heap is now [3, 1, 6, 5, 9, 10, 7, 8].",
      ),
      row(
        "compare",
        [3, 1, 6, 5, 9, 10, 7, 8],
        insert(1),
        1,
        1,
        0,
        "less",
        "parent",
        "Compare 1 at index 1 with its parent 3 at index 0. 1 is less than 3, so it swaps upward.",
      ),
      row(
        "swap",
        [1, 3, 6, 5, 9, 10, 7, 8],
        insert(1),
        1,
        0,
        1,
        null,
        "parent",
        "Swap index 1 and index 0. 1 moves up to the root. The heap is now [1, 3, 6, 5, 9, 10, 7, 8].",
      ),
    ]);
    expectHeapAfterEveryOperation(steps, operations, initial);
    expectConsistent(steps, operations);
  });

  it("removes the root, moves the last value to the root, and sifts down", () => {
    const initial = [1, 3, 4, 5];
    const operations = [extractMin, extractMin];
    const steps = heapSteps(operations, initial);

    expect(outline(steps)).toEqual([
      row(
        "start",
        initial,
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [1, 3, 4, 5], in heap order. 1 is the root.",
      ),
      row(
        "extract-min",
        [1, 3, 4, 5],
        extractMin,
        1,
        0,
        null,
        null,
        null,
        "Extract the minimum 1 from the root.",
      ),
      row(
        "last-to-root",
        [5, 3, 4],
        extractMin,
        5,
        0,
        3,
        null,
        null,
        "Move 5 from index 3 to the root. The heap is now [5, 3, 4].",
      ),
      row(
        "compare",
        [5, 3, 4],
        extractMin,
        3,
        1,
        2,
        "less",
        "children",
        "Compare the children of index 0. Index 1 holds 3 and index 2 holds 4. 3 is smaller, so the sift looks at index 1.",
      ),
      row(
        "compare",
        [5, 3, 4],
        extractMin,
        5,
        0,
        1,
        "greater",
        "child",
        "Compare 5 at index 0 with its child 3 at index 1. 5 is greater than 3, so it swaps downward.",
      ),
      row(
        "swap",
        [3, 5, 4],
        extractMin,
        5,
        1,
        0,
        null,
        "child",
        "Swap index 0 and index 1. 5 moves down to index 1, which has no children, so the sift stops. The heap is now [3, 5, 4].",
      ),
      row(
        "extract-min",
        [3, 5, 4],
        extractMin,
        3,
        0,
        null,
        null,
        null,
        "Extract the minimum 3 from the root.",
      ),
      row(
        "last-to-root",
        [4, 5],
        extractMin,
        4,
        0,
        2,
        null,
        null,
        "Move 4 from index 2 to the root. The heap is now [4, 5].",
      ),
      row(
        "compare",
        [4, 5],
        extractMin,
        4,
        0,
        1,
        "less",
        "child",
        "Compare 4 at index 0 with its child 5 at index 1. 4 is less than 5, so it stays.",
      ),
    ]);
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expect(steps[3]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).toBe(steps[2]?.values);
    expect(steps[5]?.values).not.toBe(steps[4]?.values);
    expect(steps[6]?.values).toBe(steps[5]?.values);
    expect(steps[8]?.values).toBe(steps[7]?.values);
    expect(steps[1]?.operation).toBe(steps[5]?.operation);
    expect(steps[1]?.operation).not.toBe(steps[6]?.operation);
    expectHeapAfterEveryOperation(steps, operations, initial);
    expectConsistent(steps, operations);
  });

  it("sifts the root down through the smaller child", () => {
    const initial = [1, 5, 3, 8, 9, 6, 7, 10];
    const operations = [extractMin];
    const steps = heapSteps(operations, initial);

    expect(outline(steps)).toEqual([
      row(
        "start",
        initial,
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [1, 5, 3, 8, 9, 6, 7, 10], in heap order. 1 is the root.",
      ),
      row(
        "extract-min",
        initial,
        extractMin,
        1,
        0,
        null,
        null,
        null,
        "Extract the minimum 1 from the root.",
      ),
      row(
        "last-to-root",
        [10, 5, 3, 8, 9, 6, 7],
        extractMin,
        10,
        0,
        7,
        null,
        null,
        "Move 10 from index 7 to the root. The heap is now [10, 5, 3, 8, 9, 6, 7].",
      ),
      row(
        "compare",
        [10, 5, 3, 8, 9, 6, 7],
        extractMin,
        5,
        1,
        2,
        "greater",
        "children",
        "Compare the children of index 0. Index 1 holds 5 and index 2 holds 3. 3 is smaller, so the sift looks at index 2.",
      ),
      row(
        "compare",
        [10, 5, 3, 8, 9, 6, 7],
        extractMin,
        10,
        0,
        2,
        "greater",
        "child",
        "Compare 10 at index 0 with its child 3 at index 2. 10 is greater than 3, so it swaps downward.",
      ),
      row(
        "swap",
        [3, 5, 10, 8, 9, 6, 7],
        extractMin,
        10,
        2,
        0,
        null,
        "child",
        "Swap index 0 and index 2. 10 moves down to index 2. The heap is now [3, 5, 10, 8, 9, 6, 7].",
      ),
      row(
        "compare",
        [3, 5, 10, 8, 9, 6, 7],
        extractMin,
        6,
        5,
        6,
        "less",
        "children",
        "Compare the children of index 2. Index 5 holds 6 and index 6 holds 7. 6 is smaller, so the sift looks at index 5.",
      ),
      row(
        "compare",
        [3, 5, 10, 8, 9, 6, 7],
        extractMin,
        10,
        2,
        5,
        "greater",
        "child",
        "Compare 10 at index 2 with its child 6 at index 5. 10 is greater than 6, so it swaps downward.",
      ),
      row(
        "swap",
        [3, 5, 6, 8, 9, 10, 7],
        extractMin,
        10,
        5,
        2,
        null,
        "child",
        "Swap index 2 and index 5. 10 moves down to index 5, which has no children, so the sift stops. The heap is now [3, 5, 6, 8, 9, 10, 7].",
      ),
    ]);
    expectHeapAfterEveryOperation(steps, operations, initial);
    expectConsistent(steps, operations);
    expect(settledOf(steps)).toEqual(reference(operations, initial).settled);
  });

  it("does not swap equal values and chooses the left child on a tie", () => {
    const inserted = heapSteps([insert(2)], [2, 2]);
    expect(outline(inserted)).toEqual([
      row(
        "start",
        [2, 2],
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [2, 2], in heap order. 2 is the root.",
      ),
      row(
        "insert",
        [2, 2, 2],
        insert(2),
        2,
        2,
        null,
        null,
        null,
        "Insert 2 at index 2. The heap is now [2, 2, 2].",
      ),
      row(
        "compare",
        [2, 2, 2],
        insert(2),
        2,
        2,
        0,
        "equal",
        "parent",
        "Compare 2 at index 2 with its parent 2 at index 0. The values are equal, so 2 stays.",
      ),
    ]);

    const initial = [1, 4, 4, 5];
    const extracted = heapSteps([extractMin], initial);
    expect(outline(extracted)).toEqual([
      row(
        "start",
        initial,
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [1, 4, 4, 5], in heap order. 1 is the root.",
      ),
      row(
        "extract-min",
        initial,
        extractMin,
        1,
        0,
        null,
        null,
        null,
        "Extract the minimum 1 from the root.",
      ),
      row(
        "last-to-root",
        [5, 4, 4],
        extractMin,
        5,
        0,
        3,
        null,
        null,
        "Move 5 from index 3 to the root. The heap is now [5, 4, 4].",
      ),
      row(
        "compare",
        [5, 4, 4],
        extractMin,
        4,
        1,
        2,
        "equal",
        "children",
        "Compare the children of index 0. Index 1 holds 4 and index 2 holds 4. They are equal, so the sift looks at the left child, index 1.",
      ),
      row(
        "compare",
        [5, 4, 4],
        extractMin,
        5,
        0,
        1,
        "greater",
        "child",
        "Compare 5 at index 0 with its child 4 at index 1. 5 is greater than 4, so it swaps downward.",
      ),
      row(
        "swap",
        [4, 5, 4],
        extractMin,
        5,
        1,
        0,
        null,
        "child",
        "Swap index 0 and index 1. 5 moves down to index 1, which has no children, so the sift stops. The heap is now [4, 5, 4].",
      ),
    ]);
    expectHeapAfterEveryOperation(inserted, [insert(2)], [2, 2]);
    expectHeapAfterEveryOperation(extracted, [extractMin], initial);
    expectConsistent(inserted, [insert(2)]);
    expectConsistent(extracted, [extractMin]);
  });

  it("stops sifting down when the parent is already less than or equal to its child", () => {
    const oneChild = heapSteps([extractMin], [1, 4, 3]);
    expect(outline(oneChild)).toEqual([
      row(
        "start",
        [1, 4, 3],
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [1, 4, 3], in heap order. 1 is the root.",
      ),
      row(
        "extract-min",
        [1, 4, 3],
        extractMin,
        1,
        0,
        null,
        null,
        null,
        "Extract the minimum 1 from the root.",
      ),
      row(
        "last-to-root",
        [3, 4],
        extractMin,
        3,
        0,
        2,
        null,
        null,
        "Move 3 from index 2 to the root. The heap is now [3, 4].",
      ),
      row(
        "compare",
        [3, 4],
        extractMin,
        3,
        0,
        1,
        "less",
        "child",
        "Compare 3 at index 0 with its child 4 at index 1. 3 is less than 4, so it stays.",
      ),
    ]);

    const tied = [0, 5, 4, 7, 8, 9, 4];
    const steps = heapSteps([extractMin], tied);
    expect(outline(steps)).toEqual([
      row(
        "start",
        tied,
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with [0, 5, 4, 7, 8, 9, 4], in heap order. 0 is the root.",
      ),
      row(
        "extract-min",
        tied,
        extractMin,
        0,
        0,
        null,
        null,
        null,
        "Extract the minimum 0 from the root.",
      ),
      row(
        "last-to-root",
        [4, 5, 4, 7, 8, 9],
        extractMin,
        4,
        0,
        6,
        null,
        null,
        "Move 4 from index 6 to the root. The heap is now [4, 5, 4, 7, 8, 9].",
      ),
      row(
        "compare",
        [4, 5, 4, 7, 8, 9],
        extractMin,
        5,
        1,
        2,
        "greater",
        "children",
        "Compare the children of index 0. Index 1 holds 5 and index 2 holds 4. 4 is smaller, so the sift looks at index 2.",
      ),
      row(
        "compare",
        [4, 5, 4, 7, 8, 9],
        extractMin,
        4,
        0,
        2,
        "equal",
        "child",
        "Compare 4 at index 0 with its child 4 at index 2. The values are equal, so 4 stays.",
      ),
    ]);
    expectHeapAfterEveryOperation(oneChild, [extractMin], [1, 4, 3]);
    expectHeapAfterEveryOperation(steps, [extractMin], tied);
    expectConsistent(oneChild, [extractMin]);
    expectConsistent(steps, [extractMin]);
  });

  it("extracts the only value without moving another value to the root", () => {
    const steps = heapSteps([extractMin], [7]);
    expect(outline(steps)).toEqual([
      row(
        "start",
        [7],
        null,
        null,
        null,
        null,
        null,
        null,
        "Start with 7 in the heap. It is the root.",
      ),
      row(
        "extract-min",
        [],
        extractMin,
        7,
        0,
        null,
        null,
        null,
        "Extract the minimum 7. It was the only value, so the heap is now empty.",
      ),
    ]);
    expect(steps.map((current) => current.action)).toEqual(["start", "extract-min"]);
    expectHeapAfterEveryOperation(steps, [extractMin], [7]);
    expectConsistent(steps, [extractMin]);
  });

  it("records underflow for extract-min and peek on an empty heap, then continues", () => {
    const operations: HeapOperation[] = [
      extractMin,
      peek,
      insert(1),
      extractMin,
      extractMin,
      peek,
    ];
    const steps = heapSteps(operations);

    expect(outline(steps)).toEqual([
      row("start", [], null, null, null, null, null, null, "Start with an empty heap."),
      row(
        "underflow",
        [],
        extractMin,
        null,
        null,
        null,
        null,
        null,
        "Extract the minimum of an empty heap. There is no root.",
      ),
      row(
        "underflow",
        [],
        peek,
        null,
        null,
        null,
        null,
        null,
        "Peek an empty heap. There is no root.",
      ),
      row(
        "insert",
        [1],
        insert(1),
        1,
        0,
        null,
        null,
        null,
        "Insert 1. It is now the only value, at the root.",
      ),
      row(
        "extract-min",
        [],
        extractMin,
        1,
        0,
        null,
        null,
        null,
        "Extract the minimum 1. It was the only value, so the heap is now empty.",
      ),
      row(
        "underflow",
        [],
        extractMin,
        null,
        null,
        null,
        null,
        null,
        "Extract the minimum of an empty heap. There is no root.",
      ),
      row(
        "underflow",
        [],
        peek,
        null,
        null,
        null,
        null,
        null,
        "Peek an empty heap. There is no root.",
      ),
    ]);
    expect(steps[0]?.values).toBe(steps[1]?.values);
    expect(steps[1]?.values).toBe(steps[2]?.values);
    expect(steps[4]?.values).not.toBe(steps[0]?.values);
    expect(steps[4]?.values).toBe(steps[5]?.values);
    expect(steps[5]?.values).toBe(steps[6]?.values);
    expectHeapAfterEveryOperation(steps, operations, []);
    expectConsistent(steps, operations);
  });

  it("peeks without changing the heap, including a one-value heap", () => {
    const alone = heapSteps([peek, peek], [6]);
    expect(alone.map((current) => current.action)).toEqual(["start", "peek", "peek"]);
    expect(alone[1]).toMatchObject({
      values: [6],
      value: 6,
      index: 0,
      message: "Peek 6. It stays at the root.",
    });
    expect(alone[1]?.values).toBe(alone[0]?.values);
    expect(alone[2]?.values).toBe(alone[0]?.values);
    expect(alone[2]?.value).toBe(6);

    const steps = heapSteps([peek], [1, 3, 4]);
    expect(steps[1]).toMatchObject({
      action: "peek",
      values: [1, 3, 4],
      value: 1,
      index: 0,
      message: "Peek 1. The heap stays [1, 3, 4], and 1 stays at the root.",
    });
    expect(steps[1]?.values).toBe(steps[0]?.values);
    expectHeapAfterEveryOperation(alone, [peek, peek], [6]);
    expectHeapAfterEveryOperation(steps, [peek], [1, 3, 4]);
  });

  it("orders negative numbers and fractions", () => {
    const operations = [insert(0.5), insert(-1), extractMin];
    const steps = heapSteps(operations);
    expect(steps.map((current) => current.action)).toEqual([
      "start",
      "insert",
      "insert",
      "compare",
      "swap",
      "extract-min",
      "last-to-root",
    ]);
    expect(steps[4]?.message).toBe(
      "Swap index 1 and index 0. -1 moves up to the root. The heap is now [-1, 0.5].",
    );
    expect(steps[5]?.value).toBe(-1);
    expect(steps[6]?.values).toEqual([0.5]);
    expect(steps[6]?.message).toBe(
      "Move 0.5 from index 1 to the root. It has no children, so the sift stops. The heap is now [0.5].",
    );
    expectHeapAfterEveryOperation(steps, operations, []);
    expectConsistent(steps, operations);
  });

  it("records only the opening snapshot when there are no operations", () => {
    expect(outline(heapSteps([]))).toEqual([
      row("start", [], null, null, null, null, null, null, "Start with an empty heap."),
    ]);
    const given = heapSteps([], [2, 5, 4]);
    expect(given).toHaveLength(1);
    expect(given[0]?.values).toEqual([2, 5, 4]);
    expect(given[0]?.message).toBe("Start with [2, 5, 4], in heap order. 2 is the root.");
    expect(isMinHeap(given[0]?.values ?? [])).toBe(true);
  });

  it("keeps the heap property after every operation", () => {
    const initials = [[], [0], [-2, -1, 0, 4], [1, 4, 2, 8, 5]];
    for (const initial of initials) {
      expect(isMinHeap(initial)).toBe(true);
      for (let seed = 1; seed <= 6; seed += 1) {
        for (let length = 0; length <= 16; length += 1) {
          const operations = script(seed * 100 + length, length);
          const steps = heapSteps(operations, initial);
          expectHeapAfterEveryOperation(steps, operations, initial);
          expectConsistent(steps, operations);
          const expected = reference(operations, initial);
          expect(settledOf(steps)).toEqual(expected.settled);
          expect(readsOf(steps)).toEqual(expected.reads);
        }
      }
      const longer = script(initial.length + 9, 40);
      const steps = heapSteps(longer, initial);
      expectHeapAfterEveryOperation(steps, longer, initial);
      expect(settledOf(steps)).toEqual(reference(longer, initial).settled);
    }
  });

  it("does not mutate the operations or the starting heap", () => {
    const initial = [1, 3];
    const inserted = { op: "insert" as const, value: 2 };
    const operations: HeapOperation[] = [inserted, inserted, extractMin, peek];
    const initialBefore = initial.slice();
    const operationsBefore = operations.map((operation) =>
      operation.op === "insert" ? { op: operation.op, value: operation.value } : { op: operation.op },
    );

    const steps = heapSteps(operations, initial);

    expect(initial).toEqual(initialBefore);
    expect(operations).toEqual(operationsBefore);
    expect(steps[0]?.values).not.toBe(initial);
    expect(steps[1]?.operation).not.toBe(inserted);
    expect(steps[3]?.operation).not.toBe(inserted);
    expect(steps[1]?.operation).not.toBe(steps[3]?.operation);

    initial[0] = 99;
    initial.push(8);
    inserted.value = 100;
    operations[1] = { op: "peek" };
    operations.push(extractMin);

    expect(steps[0]?.values).toEqual([1, 3]);
    expect(steps[1]?.values).toEqual([1, 3, 2]);
    expect(steps[1]?.operation).toEqual({ op: "insert", value: 2 });
    expect(steps[5]?.values).toEqual([1, 2, 2, 3]);
    expect(steps[6]?.value).toBe(2);
    expect(steps.at(-1)?.action).toBe("peek");
    expect(steps.at(-1)?.values).toEqual([2, 3, 2]);
    expect(steps.at(-1)?.value).toBe(2);

    expect(Object.isFrozen(steps[0]?.values)).toBe(true);
    expect(() => {
      (steps[0]?.values as number[])[0] = 7;
    }).toThrow(TypeError);
    expect(Object.isFrozen(steps[1]?.operation)).toBe(true);
    expect(() => {
      (steps[1]?.operation as { value: number }).value = 7;
    }).toThrow(TypeError);
  });

  it("accepts a frozen starting heap and frozen operations", () => {
    const initial = Object.freeze([1, 4, 2]);
    const operations = Object.freeze([
      Object.freeze({ op: "insert" as const, value: 0 }),
      Object.freeze({ op: "extract-min" as const }),
      Object.freeze({ op: "peek" as const }),
    ]);
    const steps = heapSteps(operations, initial);
    expect(settledOf(steps)).toEqual([
      [1, 4, 2],
      [0, 1, 2, 4],
      [1, 4, 2],
      [1, 4, 2],
    ]);
    expect(steps.at(-1)?.value).toBe(1);
    expect(initial).toEqual([1, 4, 2]);
    expect(operations[0]).toEqual({ op: "insert", value: 0 });
    expectHeapAfterEveryOperation(steps, operations, initial);
  });

  it("rejects non-finite values, a broken heap, and unknown operations", () => {
    expect(() => heapSteps([], [1, Number.NaN])).toThrow(/finite/);
    expect(() => heapSteps([], [Number.POSITIVE_INFINITY])).toThrow(/finite/);
    expect(() => heapSteps([insert(Number.NEGATIVE_INFINITY)])).toThrow(/finite/);
    expect(() => heapSteps([insert(Number.NaN)])).toThrow(/finite/);
    expect(() => heapSteps([{ op: "push" } as unknown as HeapOperation])).toThrow(
      /insert, extract-min, or peek/,
    );
    expect(() => heapSteps([null as unknown as HeapOperation])).toThrow(/insert, extract-min, or peek/);
    expect(() => heapSteps([{ op: "insert" } as unknown as HeapOperation])).toThrow(/finite/);
    expect(() => heapSteps([], [2, 1])).toThrow(/min-heap/);
    expect(() => heapSteps([], [1, 3, 2, 4, 0])).toThrow(/min-heap/);
    expect(() => heapSteps([peek], [1, 0])).toThrow(/min-heap/);
    expect(isMinHeap([1, 3, 2, 4, 5])).toBe(true);
    expect(() => heapSteps([], [1, 3, 2, 4, 5])).not.toThrow();
  });
});

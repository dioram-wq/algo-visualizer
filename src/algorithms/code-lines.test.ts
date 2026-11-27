import { describe, expect, it } from "vitest";
import { codeLine, highlightedLine, type CodeListing } from "../code-panel.ts";
import {
  BINARY_SEARCH_CODE,
  binarySearchSteps,
  type BinarySearchComparison,
} from "./binary-search.ts";
import {
  INSERTION_SORT_CODE,
  insertionSortSteps,
  type InsertionSortAction,
} from "./insertion-sort.ts";
import { MERGE_SORT_CODE, mergeSortSteps, type MergeSortAction } from "./merge-sort.ts";
import {
  QUICKSORT_CODE,
  quickSortSteps,
  type QuickSortAction,
  type QuickSortStep,
} from "./quicksort.ts";
import {
  QUEUE_CODE,
  queueSteps,
  type QueueAction,
  type QueueOperation,
  type QueueStep,
} from "./queue.ts";
import {
  STACK_CODE,
  stackSteps,
  type StackAction,
  type StackOperation,
  type StackStep,
} from "./stack.ts";

const BINARY_SEARCH_TEXT: Record<BinarySearchComparison, string> = {
  init: "low <- 0, high <- n - 1",
  equal: "    if a[mid] = target then return mid",
  less: "    if a[mid] < target then low <- mid + 1",
  greater: "    else high <- mid - 1",
  absent: "return not found",
};

const INSERTION_SORT_TEXT: Record<InsertionSortAction, string> = {
  start: "for i <- 1 to n - 1",
  compare: "    while j > 0 and a[j - 1] > a[j]",
  swap: "        swap a[j - 1] and a[j]",
  done: "the array is sorted",
};

const MERGE_SORT_TEXT: Record<MergeSortAction, string> = {
  start: "mergeSort(a, low, high)",
  split: "    mid <- floor((low + high) / 2)",
  compare: "        take the smaller front",
  write: "    write the merged run back into a",
  done: "the array is sorted",
};

const QUICKSORT_TEXT: Record<QuickSortAction, string> = {
  start: "quickSort(a, low, high)",
  pivot: "    pivot <- a[high]",
  compare: "        if a[scan] <= pivot",
  swap: "            swap a[store] and a[scan]",
  place: "    pivot is in its final position",
  done: "the array is sorted",
};

const QUICKSORT_PIVOT_SWAP = "    swap a[store] and a[high]";

const STACK_TEXT: Record<Exclude<StackAction, "underflow">, string> = {
  start: "start with the stack",
  push: "    a[top] <- x",
  pop: "    remove a[top]",
  peek: "    return a[top]",
};

const STACK_POP_UNDERFLOW = "    if pop and the stack is empty then underflow";
const STACK_PEEK_UNDERFLOW = "    if peek and the stack is empty then underflow";

const QUEUE_TEXT: Record<Exclude<QueueAction, "underflow">, string> = {
  start: "start with the queue",
  enqueue: "    add x at the back",
  dequeue: "    remove the front",
  peek: "    return the front",
};

const QUEUE_DEQUEUE_UNDERFLOW = "    if dequeue and the queue is empty then underflow";
const QUEUE_PEEK_UNDERFLOW = "    if peek and the queue is empty then underflow";

/** A scan swap leaves the pivot at the end. Seating it records the pivot on the left. */
function quickSortLineText(step: QuickSortStep): string {
  if (step.action === "swap" && step.pivot !== null && step.pivot === step.left) {
    return QUICKSORT_PIVOT_SWAP;
  }
  return QUICKSORT_TEXT[step.action];
}

/** An empty pop and an empty peek are different lines of the same action. */
function stackLineText(step: StackStep): string {
  if (step.action === "underflow") {
    if (step.operation?.op === "pop") return STACK_POP_UNDERFLOW;
    if (step.operation?.op === "peek") return STACK_PEEK_UNDERFLOW;
    throw new Error("An underflow step is missing its operation.");
  }
  return STACK_TEXT[step.action];
}

/** An empty dequeue and an empty peek are different lines of the same action. */
function queueLineText(step: QueueStep): string {
  if (step.action === "underflow") {
    if (step.operation?.op === "dequeue") return QUEUE_DEQUEUE_UNDERFLOW;
    if (step.operation?.op === "peek") return QUEUE_PEEK_UNDERFLOW;
    throw new Error("An underflow step is missing its operation.");
  }
  return QUEUE_TEXT[step.action];
}

function expectLine(listing: CodeListing, line: number, text: string) {
  expect(listing.lines[line]).toBe(text);
  expect(line).toBe(codeLine(listing, line));
  expect(highlightedLine(listing, line)).toBe(line);
}

describe("binary search step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...BINARY_SEARCH_CODE.lines]).toEqual([
      "low <- 0, high <- n - 1",
      "while low <= high",
      "    mid <- floor((low + high) / 2)",
      "    if a[mid] = target then return mid",
      "    if a[mid] < target then low <- mid + 1",
      "    else high <- mid - 1",
      "return not found",
    ]);
  });

  it("points a miss at setup, the high branch, the low branch, then not found", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 3);
    expect(steps.map((step) => step.comparison)).toEqual(["init", "greater", "less", "absent"]);
    for (const step of steps) {
      expectLine(BINARY_SEARCH_CODE, step.line, BINARY_SEARCH_TEXT[step.comparison]);
    }
  });

  it("points a match at the return line", () => {
    const steps = binarySearchSteps([1, 4, 9, 16], 16);
    const found = steps.find((step) => step.comparison === "equal");
    expect(found).toBeDefined();
    expectLine(BINARY_SEARCH_CODE, found?.line ?? -1, BINARY_SEARCH_TEXT.equal);
  });

  it("points an empty array at not found", () => {
    const steps = binarySearchSteps([], 4);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.comparison).toBe("absent");
    expectLine(BINARY_SEARCH_CODE, steps[0]?.line ?? -1, BINARY_SEARCH_TEXT.absent);
  });

  it("keeps every probe inside the listing", () => {
    const values = [2, 5, 8, 12, 16, 23, 38, 56];
    for (const target of [-1, 2, 12, 23, 56, 90]) {
      const steps = binarySearchSteps(values, target);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(BINARY_SEARCH_CODE, step.line, BINARY_SEARCH_TEXT[step.comparison]);
      }
    }
  });
});

describe("insertion sort step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...INSERTION_SORT_CODE.lines]).toEqual([
      "for i <- 1 to n - 1",
      "    j <- i",
      "    while j > 0 and a[j - 1] > a[j]",
      "        swap a[j - 1] and a[j]",
      "        j <- j - 1",
      "the array is sorted",
    ]);
  });

  it("points start, each comparison, each swap, and the finish at their lines", () => {
    const steps = insertionSortSteps([3, 1, 2]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "compare",
      "swap",
      "compare",
      "swap",
      "compare",
      "done",
    ]);
    const ordered = steps.filter((step) => step.action === "compare" && step.outOfOrder === false);
    const swapped = steps.filter((step) => step.action === "compare" && step.outOfOrder === true);
    expect(ordered.length).toBeGreaterThan(0);
    expect(swapped.length).toBeGreaterThan(0);
    for (const step of steps) {
      expectLine(INSERTION_SORT_CODE, step.line, INSERTION_SORT_TEXT[step.action]);
    }
  });

  it("points an empty array and a single value at the finished line", () => {
    for (const input of [[], [7]]) {
      const steps = insertionSortSteps(input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("done");
      expectLine(INSERTION_SORT_CODE, steps[0]?.line ?? -1, INSERTION_SORT_TEXT.done);
    }
  });

  it("keeps every action inside the listing", () => {
    const samples = [[], [1], [1, 2, 3, 4], [3, 2, 1], [5, 2, 4, 6, 1, 3], [2, 2, 1]];
    for (const input of samples) {
      const steps = insertionSortSteps(input);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(INSERTION_SORT_CODE, step.line, INSERTION_SORT_TEXT[step.action]);
      }
    }
  });
});

describe("merge sort step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...MERGE_SORT_CODE.lines]).toEqual([
      "mergeSort(a, low, high)",
      "    if low >= high then return",
      "    mid <- floor((low + high) / 2)",
      "    mergeSort(a, low, mid)",
      "    mergeSort(a, mid + 1, high)",
      "    while both halves remain",
      "        take the smaller front",
      "    write the merged run back into a",
      "the array is sorted",
    ]);
  });

  it("points start, each split, each comparison, each write, and the finish at their lines", () => {
    const steps = mergeSortSteps([3, 1, 2]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "split",
      "split",
      "compare",
      "write",
      "write",
      "compare",
      "compare",
      "write",
      "write",
      "write",
      "done",
    ]);
    const taken = steps.filter((step) => step.action === "compare").map((step) => step.taken);
    expect(taken).toEqual(["right", "left", "right"]);
    for (const step of steps) {
      expectLine(MERGE_SORT_CODE, step.line, MERGE_SORT_TEXT[step.action]);
    }
  });

  it("points an empty array and a single value at the finished line", () => {
    for (const input of [[], [7]]) {
      const steps = mergeSortSteps(input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("done");
      expectLine(MERGE_SORT_CODE, steps[0]?.line ?? -1, MERGE_SORT_TEXT.done);
    }
  });

  it("keeps every action inside the listing", () => {
    const samples = [[], [1], [1, 2, 3, 4], [3, 2, 1], [5, 2, 4, 6, 1, 3], [2, 2, 1]];
    for (const input of samples) {
      const steps = mergeSortSteps(input);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(MERGE_SORT_CODE, step.line, MERGE_SORT_TEXT[step.action]);
      }
    }
  });
});

describe("quicksort step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...QUICKSORT_CODE.lines]).toEqual([
      "quickSort(a, low, high)",
      "    if low >= high then return",
      "    pivot <- a[high]",
      "    store <- low",
      "    for scan <- low to high - 1",
      "        if a[scan] <= pivot",
      "            swap a[store] and a[scan]",
      "    swap a[store] and a[high]",
      "    pivot is in its final position",
      "    quickSort(a, low, store - 1)",
      "    quickSort(a, store + 1, high)",
      "the array is sorted",
    ]);
  });

  it("points a scan swap and the swap that seats the pivot at different lines", () => {
    const steps = quickSortSteps([3, 1, 2]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "pivot",
      "compare",
      "compare",
      "swap",
      "swap",
      "place",
      "done",
    ]);
    const scan = steps[4];
    const seated = steps[5];
    expect(scan?.action).toBe("swap");
    expect(scan?.left).toBe(0);
    expect(scan?.right).toBe(1);
    expect(scan?.pivot).not.toBe(scan?.left);
    expect(seated?.action).toBe("swap");
    expect(seated?.pivot).toBe(seated?.left);
    expect(seated?.right).toBe(2);
    for (const step of steps) {
      expectLine(QUICKSORT_CODE, step.line, quickSortLineText(step));
    }
    expect(scan?.line).not.toBe(seated?.line);
  });

  it("points a pivot that is already last at the final-position line, with no swap", () => {
    const steps = quickSortSteps([1, 2, 3]);
    expect(steps.some((step) => step.action === "swap")).toBe(false);
    const placed = steps.filter((step) => step.action === "place");
    expect(placed.length).toBeGreaterThan(0);
    for (const step of steps) {
      expectLine(QUICKSORT_CODE, step.line, quickSortLineText(step));
    }
  });

  it("points an empty array and a single value at the finished line", () => {
    for (const input of [[], [7]]) {
      const steps = quickSortSteps(input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("done");
      expectLine(QUICKSORT_CODE, steps[0]?.line ?? -1, QUICKSORT_TEXT.done);
    }
  });

  it("keeps every action inside the listing", () => {
    const samples = [[], [1], [1, 2, 3, 4], [3, 2, 1], [5, 2, 4, 6, 1, 3], [2, 2, 1], [2, 3, 1]];
    let sawScanSwap = false;
    let sawPivotSwap = false;
    for (const input of samples) {
      const steps = quickSortSteps(input);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(QUICKSORT_CODE, step.line, quickSortLineText(step));
        if (step.action === "swap" && step.pivot === step.left) sawPivotSwap = true;
        if (step.action === "swap" && step.pivot !== step.left) sawScanSwap = true;
      }
    }
    expect(sawScanSwap).toBe(true);
    expect(sawPivotSwap).toBe(true);
  });
});

describe("stack step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...STACK_CODE.lines]).toEqual([
      "start with the stack",
      "push(x)",
      "    a[top] <- x",
      "pop()",
      "    if pop and the stack is empty then underflow",
      "    remove a[top]",
      "peek()",
      "    if peek and the stack is empty then underflow",
      "    return a[top]",
    ]);
  });

  it("points start, each push, a peek, and each pop at their lines", () => {
    const steps = stackSteps([
      { op: "push", value: 4 },
      { op: "push", value: 9 },
      { op: "peek" },
      { op: "pop" },
      { op: "push", value: 2 },
      { op: "pop" },
      { op: "pop" },
    ]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "push",
      "push",
      "peek",
      "pop",
      "push",
      "pop",
      "pop",
    ]);
    for (const step of steps) {
      expectLine(STACK_CODE, step.line, stackLineText(step));
    }
  });

  it("points an empty pop and an empty peek at different underflow lines", () => {
    const steps = stackSteps([{ op: "pop" }, { op: "peek" }]);
    expect(steps.map((step) => step.action)).toEqual(["start", "underflow", "underflow"]);
    expect(steps[1]?.operation).toEqual({ op: "pop" });
    expect(steps[2]?.operation).toEqual({ op: "peek" });
    for (const step of steps) {
      expectLine(STACK_CODE, step.line, stackLineText(step));
    }
    expect(steps[1]?.line).not.toBe(steps[2]?.line);
  });

  it("points an empty stack and a single starting value at the start line", () => {
    for (const input of [[], [7]]) {
      const steps = stackSteps([], input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("start");
      expectLine(STACK_CODE, steps[0]?.line ?? -1, STACK_TEXT.start);
    }
  });

  it("keeps every action inside the listing", () => {
    const scripts: { initial: readonly number[]; operations: readonly StackOperation[] }[] = [
      { initial: [], operations: [] },
      { initial: [7], operations: [] },
      { initial: [], operations: [{ op: "pop" }, { op: "peek" }] },
      {
        initial: [1, 4],
        operations: [{ op: "pop" }, { op: "peek" }, { op: "pop" }, { op: "pop" }],
      },
      {
        initial: [],
        operations: [
          { op: "push", value: 4 },
          { op: "push", value: 9 },
          { op: "peek" },
          { op: "pop" },
          { op: "push", value: 2 },
          { op: "pop" },
          { op: "pop" },
          { op: "peek" },
        ],
      },
    ];
    let sawPop = false;
    let sawPeek = false;
    let sawPopUnderflow = false;
    let sawPeekUnderflow = false;
    for (const script of scripts) {
      const steps = stackSteps(script.operations, script.initial);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(STACK_CODE, step.line, stackLineText(step));
        if (step.action === "pop") sawPop = true;
        if (step.action === "peek") sawPeek = true;
        if (step.action === "underflow" && step.operation?.op === "pop") sawPopUnderflow = true;
        if (step.action === "underflow" && step.operation?.op === "peek") sawPeekUnderflow = true;
      }
    }
    expect(sawPop).toBe(true);
    expect(sawPeek).toBe(true);
    expect(sawPopUnderflow).toBe(true);
    expect(sawPeekUnderflow).toBe(true);
  });
});

describe("queue step lines", () => {
  it("lists the pseudocode the panel shows", () => {
    expect([...QUEUE_CODE.lines]).toEqual([
      "start with the queue",
      "enqueue(x)",
      "    add x at the back",
      "dequeue()",
      "    if dequeue and the queue is empty then underflow",
      "    remove the front",
      "peek()",
      "    if peek and the queue is empty then underflow",
      "    return the front",
    ]);
  });

  it("points start, each enqueue, a peek, and each dequeue at their lines", () => {
    const steps = queueSteps([
      { op: "enqueue", value: 4 },
      { op: "enqueue", value: 9 },
      { op: "peek" },
      { op: "dequeue" },
      { op: "enqueue", value: 2 },
      { op: "dequeue" },
      { op: "dequeue" },
    ]);
    expect(steps.map((step) => step.action)).toEqual([
      "start",
      "enqueue",
      "enqueue",
      "peek",
      "dequeue",
      "enqueue",
      "dequeue",
      "dequeue",
    ]);
    for (const step of steps) {
      expectLine(QUEUE_CODE, step.line, queueLineText(step));
    }
  });

  it("points an empty dequeue and an empty peek at different underflow lines", () => {
    const steps = queueSteps([{ op: "dequeue" }, { op: "peek" }]);
    expect(steps.map((step) => step.action)).toEqual(["start", "underflow", "underflow"]);
    expect(steps[1]?.operation).toEqual({ op: "dequeue" });
    expect(steps[2]?.operation).toEqual({ op: "peek" });
    for (const step of steps) {
      expectLine(QUEUE_CODE, step.line, queueLineText(step));
    }
    expect(steps[1]?.line).not.toBe(steps[2]?.line);
  });

  it("points an empty queue and a single starting value at the start line", () => {
    for (const input of [[], [7]]) {
      const steps = queueSteps([], input);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.action).toBe("start");
      expectLine(QUEUE_CODE, steps[0]?.line ?? -1, QUEUE_TEXT.start);
    }
  });

  it("keeps every action inside the listing", () => {
    const scripts: { initial: readonly number[]; operations: readonly QueueOperation[] }[] = [
      { initial: [], operations: [] },
      { initial: [7], operations: [] },
      { initial: [], operations: [{ op: "dequeue" }, { op: "peek" }] },
      {
        initial: [1, 4],
        operations: [{ op: "dequeue" }, { op: "peek" }, { op: "dequeue" }, { op: "dequeue" }],
      },
      {
        initial: [],
        operations: [
          { op: "enqueue", value: 4 },
          { op: "enqueue", value: 9 },
          { op: "peek" },
          { op: "dequeue" },
          { op: "enqueue", value: 2 },
          { op: "dequeue" },
          { op: "dequeue" },
          { op: "peek" },
        ],
      },
    ];
    let sawDequeue = false;
    let sawPeek = false;
    let sawDequeueUnderflow = false;
    let sawPeekUnderflow = false;
    for (const script of scripts) {
      const steps = queueSteps(script.operations, script.initial);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expectLine(QUEUE_CODE, step.line, queueLineText(step));
        if (step.action === "dequeue") sawDequeue = true;
        if (step.action === "peek") sawPeek = true;
        if (step.action === "underflow" && step.operation?.op === "dequeue") {
          sawDequeueUnderflow = true;
        }
        if (step.action === "underflow" && step.operation?.op === "peek") sawPeekUnderflow = true;
      }
    }
    expect(sawDequeue).toBe(true);
    expect(sawPeek).toBe(true);
    expect(sawDequeueUnderflow).toBe(true);
    expect(sawPeekUnderflow).toBe(true);
  });
});

describe("highlighted line", () => {
  it("marks an in-range index and ignores an empty or invalid one", () => {
    const listing = BINARY_SEARCH_CODE;
    expect(highlightedLine(listing, null)).toBeNull();
    expect(highlightedLine(listing, 0)).toBe(0);
    expect(highlightedLine(listing, listing.lines.length - 1)).toBe(listing.lines.length - 1);
    expect(highlightedLine(listing, -1)).toBeNull();
    expect(highlightedLine(listing, listing.lines.length)).toBeNull();
    expect(highlightedLine(listing, 1.5)).toBeNull();
    expect(highlightedLine(listing, Number.NaN)).toBeNull();
  });

  it("rejects a line outside the listing", () => {
    expect(() => codeLine(BINARY_SEARCH_CODE, -1)).toThrow(RangeError);
    expect(() => codeLine(BINARY_SEARCH_CODE, BINARY_SEARCH_CODE.lines.length)).toThrow(RangeError);
    expect(() => codeLine(INSERTION_SORT_CODE, 1.5)).toThrow(RangeError);
  });
});

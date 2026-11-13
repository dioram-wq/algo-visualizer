export type QuickSortAction = "start" | "pivot" | "compare" | "swap" | "place" | "done";

export interface QuickSortStep {
  readonly values: readonly number[];
  /**
   * Inclusive bounds of the subarray being partitioned.
   * Null on the opening and finished arrays.
   */
  readonly low: number | null;
  readonly high: number | null;
  /**
   * Index of the pivot. It starts at `high` and moves to its final index
   * on the swap that places it, then stays there on the place step.
   * Null on start and done.
   */
  readonly pivot: number | null;
  /** Left index of a comparison or swap. Null otherwise. */
  readonly left: number | null;
  /** Right index of a comparison or swap. Null otherwise. */
  readonly right: number | null;
  /**
   * On a compare step, whether the scanned value is less than or equal to the pivot.
   * Null otherwise.
   */
  readonly lessOrEqual: boolean | null;
  readonly action: QuickSortAction;
  readonly message: string;
}

/**
 * Record every partition of Lomuto quicksort.
 * The pivot is the last element of the active range. Each other element in
 * that range is compared with the pivot, and a value less than or equal to
 * the pivot swaps left when it is not already in the next open slot. The
 * pivot then swaps into that boundary, which is its final index. A swap of
 * an index with itself is omitted, because the array does not change.
 * The caller's array is copied, and each arrangement is frozen, so later
 * edits do not rewrite old steps.
 */
export function quickSortSteps(input: readonly number[]): QuickSortStep[] {
  if (input.some((value) => !Number.isFinite(value))) {
    throw new RangeError("quickSortSteps expects finite numbers.");
  }

  const working = input.slice();
  const length = working.length;
  if (length <= 1) {
    return [step(freeze(working), null, null, null, null, null, null, "done")];
  }

  let values = freeze(working.slice());
  const steps: QuickSortStep[] = [
    step(values, null, null, null, null, null, null, "start"),
  ];

  sortRange(0, length - 1);
  steps.push(step(values, null, null, null, null, null, null, "done"));
  return steps;

  function sortRange(low: number, high: number): void {
    if (low >= high) return;
    const pivotIndex = partition(low, high);
    sortRange(low, pivotIndex - 1);
    sortRange(pivotIndex + 1, high);
  }

  function partition(low: number, high: number): number {
    const pivotValue = working[high];
    if (pivotValue === undefined) {
      throw new RangeError("Sort index fell outside the array.");
    }
    steps.push(step(values, low, high, high, null, null, null, "pivot"));

    let store = low;
    for (let scan = low; scan < high; scan += 1) {
      const scanValue = working[scan];
      if (scanValue === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      const lessOrEqual = scanValue <= pivotValue;
      steps.push(step(values, low, high, high, scan, high, lessOrEqual, "compare"));
      if (!lessOrEqual) continue;
      if (store !== scan) {
        exchange(store, scan);
        steps.push(step(values, low, high, high, store, scan, null, "swap"));
      }
      store += 1;
    }

    if (store !== high) {
      exchange(store, high);
      steps.push(step(values, low, high, store, store, high, null, "swap"));
    }
    steps.push(step(values, low, high, store, null, null, null, "place"));
    return store;
  }

  function exchange(left: number, right: number): void {
    const leftValue = working[left];
    const rightValue = working[right];
    if (leftValue === undefined || rightValue === undefined) {
      throw new RangeError("Sort index fell outside the array.");
    }
    working[left] = rightValue;
    working[right] = leftValue;
    values = freeze(working.slice());
  }
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  low: number | null,
  high: number | null,
  pivot: number | null,
  left: number | null,
  right: number | null,
  lessOrEqual: boolean | null,
  action: QuickSortAction,
): QuickSortStep {
  return {
    values,
    low,
    high,
    pivot,
    left,
    right,
    lessOrEqual,
    action,
    message: describe(values, low, high, pivot, left, right, lessOrEqual, action),
  };
}

function describe(
  values: readonly number[],
  low: number | null,
  high: number | null,
  pivot: number | null,
  left: number | null,
  right: number | null,
  lessOrEqual: boolean | null,
  action: QuickSortAction,
): string {
  switch (action) {
    case "start":
      return `Start with ${values.length} values. Each partition uses the last element of the active range as the pivot.`;
    case "done":
      if (values.length === 0) return "The array is empty, so it is already sorted.";
      if (values.length === 1) return "The only value is already sorted.";
      return "Every pivot is in its final position. The array is sorted.";
    case "pivot": {
      const chosen = readPivot(values, low, high, pivot);
      return `Choose ${chosen.value} at index ${chosen.pivot} as the pivot for ${rangePhrase(chosen.low, chosen.high)}.`;
    }
    case "compare": {
      const pair = readPair(values, left, right);
      if (lessOrEqual === null) {
        throw new RangeError("A comparison step is missing its result.");
      }
      if (lessOrEqual) {
        return `Index ${pair.left} holds ${pair.leftValue}, which is less than or equal to the pivot ${pair.rightValue} at index ${pair.right}. It belongs on the left.`;
      }
      return `Index ${pair.left} holds ${pair.leftValue}, which is greater than the pivot ${pair.rightValue} at index ${pair.right}. It stays on the right.`;
    }
    case "swap": {
      const pair = readPair(values, left, right);
      if (pivot === pair.left) {
        return `Swap indices ${pair.left} and ${pair.right}. The pivot moves to index ${pair.left}.`;
      }
      return `Swap indices ${pair.left} and ${pair.right}.`;
    }
    case "place": {
      const placed = readPivot(values, low, high, pivot);
      return `${placed.value} is now at index ${placed.pivot}, its final position. ${leftOfPivot(placed)} ${rightOfPivot(placed)}`;
    }
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected quicksort action: ${String(unexpected)}`);
    }
  }
}

function rangePhrase(low: number, high: number): string {
  return low === high ? `index ${low}` : `indices ${low} through ${high}`;
}

function leftOfPivot(placed: { low: number; pivot: number }): string {
  if (placed.pivot === placed.low) return "Nothing is to its left.";
  if (placed.pivot === placed.low + 1) return `Index ${placed.low} is less than or equal to it.`;
  return `Indices ${placed.low} through ${placed.pivot - 1} are less than or equal to it.`;
}

function rightOfPivot(placed: { high: number; pivot: number }): string {
  if (placed.pivot === placed.high) return "Nothing is to its right.";
  if (placed.pivot + 1 === placed.high) return `Index ${placed.high} is greater than it.`;
  return `Indices ${placed.pivot + 1} through ${placed.high} are greater than it.`;
}

function readPivot(
  values: readonly number[],
  low: number | null,
  high: number | null,
  pivot: number | null,
): { low: number; high: number; pivot: number; value: number } {
  if (low === null || high === null || pivot === null) {
    throw new RangeError("A partition is missing its pivot.");
  }
  const value = values[pivot];
  if (value === undefined) {
    throw new RangeError("A partition is missing its pivot.");
  }
  return { low, high, pivot, value };
}

function readPair(
  values: readonly number[],
  left: number | null,
  right: number | null,
): { left: number; right: number; leftValue: number; rightValue: number } {
  if (left === null || right === null) {
    throw new RangeError("A comparison or swap is missing its pair.");
  }
  const leftValue = values[left];
  const rightValue = values[right];
  if (leftValue === undefined || rightValue === undefined) {
    throw new RangeError("A comparison or swap is missing its pair.");
  }
  return { left, right, leftValue, rightValue };
}

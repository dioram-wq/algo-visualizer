export type MergeSortAction = "start" | "split" | "compare" | "write" | "done";

/** Which sorted run supplies the next value. Ties take the left run. */
export type MergeSide = "left" | "right";

export interface MergeSortStep {
  readonly values: readonly number[];
  /**
   * Inclusive bounds of the subarray being split or merged.
   * Null on the opening and finished arrays.
   */
  readonly low: number | null;
  readonly high: number | null;
  /**
   * Last index of the left half.
   * Set on a split and while that split's two halves are merged.
   */
  readonly mid: number | null;
  /** Index in the left run during a comparison. Null otherwise. */
  readonly left: number | null;
  /** Index in the right run during a comparison. Null otherwise. */
  readonly right: number | null;
  /** Which run wins a comparison. Null except on a compare step. */
  readonly taken: MergeSide | null;
  /** Destination of a write back into the array. Null except on a write step. */
  readonly writeIndex: number | null;
  readonly action: MergeSortAction;
  readonly message: string;
}

/**
 * Record every split, comparison, and write of top-down merge sort.
 * The caller's array is copied, and each arrangement is frozen, so later
 * edits do not rewrite old steps. Comparisons for a merge read the array
 * before that merge writes anything back.
 */
export function mergeSortSteps(input: readonly number[]): MergeSortStep[] {
  if (input.some((value) => !Number.isFinite(value))) {
    throw new RangeError("mergeSortSteps expects finite numbers.");
  }

  const working = input.slice();
  const length = working.length;
  if (length <= 1) {
    return [step(freeze(working), null, null, null, null, null, null, null, "done")];
  }

  let values = freeze(working.slice());
  const steps: MergeSortStep[] = [
    step(values, null, null, null, null, null, null, null, "start"),
  ];

  sortRange(0, length - 1);
  steps.push(step(values, null, null, null, null, null, null, null, "done"));
  return steps;

  function sortRange(low: number, high: number): void {
    if (low >= high) return;
    const mid = Math.floor((low + high) / 2);
    steps.push(step(values, low, high, mid, null, null, null, null, "split"));
    sortRange(low, mid);
    sortRange(mid + 1, high);
    merge(low, mid, high);
  }

  function merge(low: number, mid: number, high: number): void {
    const merged: number[] = [];
    let left = low;
    let right = mid + 1;
    while (left <= mid && right <= high) {
      const leftValue = working[left];
      const rightValue = working[right];
      if (leftValue === undefined || rightValue === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      // Take the left value on a tie so equal elements keep their order.
      const taken: MergeSide = leftValue <= rightValue ? "left" : "right";
      steps.push(step(values, low, high, mid, left, right, taken, null, "compare"));
      if (taken === "left") {
        merged.push(leftValue);
        left += 1;
      } else {
        merged.push(rightValue);
        right += 1;
      }
    }
    while (left <= mid) {
      const leftValue = working[left];
      if (leftValue === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      merged.push(leftValue);
      left += 1;
    }
    while (right <= high) {
      const rightValue = working[right];
      if (rightValue === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      merged.push(rightValue);
      right += 1;
    }

    // Copy the merged run back one index at a time. Until the copy finishes,
    // the array can repeat a value that is still sitting in the run, because
    // the merged values live in a temporary buffer.
    for (let offset = 0; offset < merged.length; offset += 1) {
      const writeIndex = low + offset;
      const nextValue = merged[offset];
      const current = working[writeIndex];
      if (nextValue === undefined || current === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      if (current !== nextValue) {
        working[writeIndex] = nextValue;
        values = freeze(working.slice());
      }
      steps.push(step(values, low, high, mid, null, null, null, writeIndex, "write"));
    }
  }
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  low: number | null,
  high: number | null,
  mid: number | null,
  left: number | null,
  right: number | null,
  taken: MergeSide | null,
  writeIndex: number | null,
  action: MergeSortAction,
): MergeSortStep {
  return {
    values,
    low,
    high,
    mid,
    left,
    right,
    taken,
    writeIndex,
    action,
    message: describe(values, low, high, mid, left, right, taken, writeIndex, action),
  };
}

function describe(
  values: readonly number[],
  low: number | null,
  high: number | null,
  mid: number | null,
  left: number | null,
  right: number | null,
  taken: MergeSide | null,
  writeIndex: number | null,
  action: MergeSortAction,
): string {
  switch (action) {
    case "start":
      return `Start with ${values.length} values. Split them into single elements, then merge the sorted halves.`;
    case "done":
      if (values.length === 0) return "The array is empty, so it is already sorted.";
      if (values.length === 1) return "The only value is already sorted.";
      return "Every subarray has been merged. The array is sorted.";
    case "split": {
      const range = readRange(low, high, mid);
      return `Split ${rangePhrase(range.low, range.high)} at index ${range.mid}. The left half is ${rangePhrase(range.low, range.mid)}, and the right half is ${rangePhrase(range.mid + 1, range.high)}.`;
    }
    case "compare": {
      const pair = readPair(values, left, right);
      if (taken === null) {
        throw new RangeError("A comparison step is missing its result.");
      }
      if (taken === "left") {
        return `Index ${pair.left} holds ${pair.leftValue}, which is less than or equal to ${pair.rightValue} at index ${pair.right}. Take the left value.`;
      }
      return `Index ${pair.left} holds ${pair.leftValue}, which is greater than ${pair.rightValue} at index ${pair.right}. Take the right value.`;
    }
    case "write": {
      const written = readIndex(values, writeIndex);
      return `Write ${written.value} at index ${written.index}.`;
    }
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected merge sort action: ${String(unexpected)}`);
    }
  }
}

function rangePhrase(low: number, high: number): string {
  return low === high ? `index ${low}` : `indices ${low} through ${high}`;
}

function readRange(
  low: number | null,
  high: number | null,
  mid: number | null,
): { low: number; high: number; mid: number } {
  if (low === null || high === null || mid === null) {
    throw new RangeError("A split is missing its range.");
  }
  return { low, high, mid };
}

function readPair(
  values: readonly number[],
  left: number | null,
  right: number | null,
): { left: number; right: number; leftValue: number; rightValue: number } {
  if (left === null || right === null) {
    throw new RangeError("A comparison is missing its pair.");
  }
  const leftValue = values[left];
  const rightValue = values[right];
  if (leftValue === undefined || rightValue === undefined) {
    throw new RangeError("A comparison is missing its pair.");
  }
  return { left, right, leftValue, rightValue };
}

function readIndex(values: readonly number[], index: number | null): { index: number; value: number } {
  if (index === null) {
    throw new RangeError("A write is missing its index.");
  }
  const value = values[index];
  if (value === undefined) {
    throw new RangeError("A write is missing its index.");
  }
  return { index, value };
}

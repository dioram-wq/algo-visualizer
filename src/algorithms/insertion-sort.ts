export type InsertionSortAction = "start" | "compare" | "swap" | "done";

export interface InsertionSortStep {
  readonly values: readonly number[];
  /**
   * Leading positions the sort has taken in.
   * Indices in `[0, sortedPrefix)` are in order once `keyIndex` is null.
   * While `keyIndex` is set, that one value is still moving and the other
   * values in the prefix are in order.
   */
  readonly sortedPrefix: number;
  /**
   * Index of the value still moving left inside the prefix.
   * Null when the prefix is settled, including the opening and finished arrays.
   */
  readonly keyIndex: number | null;
  /** Left index of a comparison or swap. Null on start and done. */
  readonly left: number | null;
  /** Right index of a comparison or swap. Always `left + 1` when set. */
  readonly right: number | null;
  /** On a compare step, whether the left value is greater than the right value. */
  readonly outOfOrder: boolean | null;
  readonly action: InsertionSortAction;
  readonly message: string;
}

/**
 * Record every comparison and adjacent swap of insertion sort.
 * The caller's array is copied, and each arrangement is frozen, so later
 * edits do not rewrite old steps.
 */
export function insertionSortSteps(input: readonly number[]): InsertionSortStep[] {
  if (input.some((value) => !Number.isFinite(value))) {
    throw new RangeError("insertionSortSteps expects finite numbers.");
  }

  const working = input.slice();
  const length = working.length;
  if (length <= 1) {
    return [step(freeze(working), length, null, null, null, null, "done")];
  }

  let values = freeze(working.slice());
  let sortedPrefix = 1;
  const steps: InsertionSortStep[] = [
    step(values, sortedPrefix, null, null, null, null, "start"),
  ];

  for (let index = 1; index < length; index += 1) {
    let cursor = index;
    sortedPrefix = index + 1;
    while (cursor > 0) {
      const left = cursor - 1;
      const right = cursor;
      const leftValue = working[left];
      const rightValue = working[right];
      if (leftValue === undefined || rightValue === undefined) {
        throw new RangeError("Sort index fell outside the array.");
      }
      const outOfOrder = leftValue > rightValue;
      steps.push(
        step(values, sortedPrefix, outOfOrder ? right : null, left, right, outOfOrder, "compare"),
      );
      if (!outOfOrder) break;

      working[left] = rightValue;
      working[right] = leftValue;
      cursor -= 1;
      values = freeze(working.slice());
      steps.push(
        step(values, sortedPrefix, cursor === 0 ? null : cursor, left, right, null, "swap"),
      );
    }
  }

  steps.push(step(values, length, null, null, null, null, "done"));
  return steps;
}

function freeze(values: readonly number[]): readonly number[] {
  return Object.freeze(values.slice());
}

function step(
  values: readonly number[],
  sortedPrefix: number,
  keyIndex: number | null,
  left: number | null,
  right: number | null,
  outOfOrder: boolean | null,
  action: InsertionSortAction,
): InsertionSortStep {
  return {
    values,
    sortedPrefix,
    keyIndex,
    left,
    right,
    outOfOrder,
    action,
    message: describe(values, sortedPrefix, keyIndex, left, right, outOfOrder, action),
  };
}

function describe(
  values: readonly number[],
  sortedPrefix: number,
  keyIndex: number | null,
  left: number | null,
  right: number | null,
  outOfOrder: boolean | null,
  action: InsertionSortAction,
): string {
  switch (action) {
    case "start":
      return `Start with ${values.length} values. Index 0 is a sorted prefix of one element.`;
    case "done":
      if (values.length === 0) return "The array is empty, so it is already sorted.";
      if (values.length === 1) return "The only value is already a sorted prefix.";
      return "Every element is in the sorted prefix. The array is sorted.";
    case "compare": {
      const pair = readPair(values, left, right);
      if (outOfOrder === null) {
        throw new RangeError("A comparison step is missing its result.");
      }
      if (outOfOrder) {
        return `Index ${pair.left} holds ${pair.leftValue}, which is greater than ${pair.rightValue} at index ${pair.right}. Swap them so the smaller value moves left.`;
      }
      return `Index ${pair.left} holds ${pair.leftValue}, which is less than or equal to ${pair.rightValue} at index ${pair.right}. The sorted prefix now covers indices 0 through ${sortedPrefix - 1}.`;
    }
    case "swap": {
      const pair = readPair(values, left, right);
      if (keyIndex === null) {
        return `Swap indices ${pair.left} and ${pair.right}. ${pair.leftValue} is now at the front, so the sorted prefix covers indices 0 through ${sortedPrefix - 1}.`;
      }
      return `Swap indices ${pair.left} and ${pair.right}. ${pair.leftValue} moves left to index ${keyIndex}.`;
    }
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected insertion sort action: ${String(unexpected)}`);
    }
  }
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

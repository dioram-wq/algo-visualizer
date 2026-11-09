export type BinarySearchComparison = "init" | "less" | "greater" | "equal" | "absent";

export interface BinarySearchStep {
  readonly values: readonly number[];
  readonly target: number;
  readonly low: number;
  readonly high: number;
  readonly mid: number | null;
  readonly comparison: BinarySearchComparison;
  readonly foundIndex: number | null;
  readonly message: string;
}

/**
 * Record every probe of binary search on a non-decreasing array.
 * The caller's array is copied, so later edits do not rewrite old steps.
 */
export function binarySearchSteps(
  input: readonly number[],
  target: number,
): BinarySearchStep[] {
  if (!Number.isFinite(target) || input.some((value) => !Number.isFinite(value))) {
    throw new RangeError("binarySearchSteps expects finite numbers.");
  }
  if (!isNonDecreasing(input)) {
    throw new RangeError("binarySearchSteps expects a non-decreasing array.");
  }

  const values = Object.freeze(input.slice());
  const steps: BinarySearchStep[] = [];
  let low = 0;
  let high = values.length - 1;

  if (values.length === 0) {
    steps.push(step(values, target, low, high, null, "absent", null));
    return steps;
  }

  steps.push(step(values, target, low, high, null, "init", null));

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = values[mid];
    if (value === undefined) {
      throw new RangeError("Search index fell outside the array.");
    }
    if (value === target) {
      steps.push(step(values, target, low, high, mid, "equal", mid));
      return steps;
    }
    if (value < target) {
      steps.push(step(values, target, low, high, mid, "less", null));
      low = mid + 1;
    } else {
      steps.push(step(values, target, low, high, mid, "greater", null));
      high = mid - 1;
    }
  }

  steps.push(step(values, target, low, high, null, "absent", null));
  return steps;
}

function isNonDecreasing(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || current < previous) {
      return false;
    }
  }
  return true;
}

function step(
  values: readonly number[],
  target: number,
  low: number,
  high: number,
  mid: number | null,
  comparison: BinarySearchComparison,
  foundIndex: number | null,
): BinarySearchStep {
  return {
    values,
    target,
    low,
    high,
    mid,
    comparison,
    foundIndex,
    message: describe(values, target, low, high, mid, comparison),
  };
}

function describe(
  values: readonly number[],
  target: number,
  low: number,
  high: number,
  mid: number | null,
  comparison: BinarySearchComparison,
): string {
  if (comparison === "init") {
    return low === high
      ? `Start with the only index, ${low}.`
      : `Start with the full range, indices ${low} through ${high}.`;
  }
  if (comparison === "absent") {
    return values.length === 0
      ? `The array is empty, so ${target} is not in it.`
      : `The search window is empty, so ${target} is not in the array.`;
  }

  const probed = mid === null ? undefined : values[mid];
  if (mid === null || probed === undefined) {
    throw new RangeError("A comparison step is missing its midpoint.");
  }
  if (comparison === "equal") {
    return `Index ${mid} holds ${probed}, which equals ${target}.`;
  }
  if (comparison === "less") {
    return `Index ${mid} holds ${probed}, which is less than ${target}. Drop the left side and continue from index ${mid + 1}.`;
  }
  return `Index ${mid} holds ${probed}, which is greater than ${target}. Drop the right side and continue through index ${mid - 1}.`;
}

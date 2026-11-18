import type { BstOperation } from "./algorithms/bst.ts";
import { parseFiniteNumber } from "./parse-numbers.ts";

/** Parse a comma- or newline-separated list of insert and search. A blank field is an empty list. */
export function parseBstOperations(text: string): BstOperation[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseBstOperation);
}

function parseBstOperation(token: string): BstOperation {
  const parts = token.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if ((name === "insert" || name === "search") && parts.length === 2) {
    const valueToken = parts[1];
    if (valueToken === undefined) {
      throw new Error(`"${token}" is not a binary search tree operation with one finite number.`);
    }
    return { op: name, value: parseFiniteNumber(valueToken) };
  }
  throw new Error(`"${token}" is not a binary search tree operation. Use "insert 8" or "search 3".`);
}

import type { HeapOperation } from "./algorithms/heap.ts";
import { parseFiniteNumber } from "./parse-numbers.ts";

/** Parse a comma- or newline-separated list of insert, extract-min, and peek. A blank field is an empty list. */
export function parseHeapOperations(text: string): HeapOperation[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseHeapOperation);
}

function parseHeapOperation(token: string): HeapOperation {
  const parts = token.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if ((name === "extract-min" || name === "peek") && parts.length === 1) {
    return { op: name };
  }
  if (name === "insert" && parts.length === 2) {
    const valueToken = parts[1];
    if (valueToken === undefined) {
      throw new Error(`"${token}" is not an insert of one finite number.`);
    }
    return { op: "insert", value: parseFiniteNumber(valueToken) };
  }
  throw new Error(`"${token}" is not a heap operation. Use "insert 4", "extract-min", or "peek".`);
}

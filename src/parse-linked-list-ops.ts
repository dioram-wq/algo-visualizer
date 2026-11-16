import type { LinkedListOperation } from "./algorithms/linked-list.ts";
import { parseFiniteNumber } from "./parse-numbers.ts";

/** Parse a comma- or newline-separated list of linked list operations. A blank field is an empty list. */
export function parseLinkedListOperations(text: string): LinkedListOperation[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseLinkedListOperation);
}

function parseLinkedListOperation(token: string): LinkedListOperation {
  const parts = token.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if (
    (name === "insert-head" || name === "insert-tail" || name === "search" || name === "delete") &&
    parts.length === 2
  ) {
    const valueToken = parts[1];
    if (valueToken === undefined) {
      throw new Error(`"${token}" is not a linked list operation with one finite number.`);
    }
    return { op: name, value: parseFiniteNumber(valueToken) };
  }
  throw new Error(
    `"${token}" is not a linked list operation. Use "insert-head 4", "insert-tail 9", "search 4", or "delete 4".`,
  );
}

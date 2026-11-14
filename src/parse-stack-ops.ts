import type { StackOperation } from "./algorithms/stack.ts";
import { parseFiniteNumber } from "./parse-numbers.ts";

/** Parse a comma- or newline-separated list of push, pop, and peek. A blank field is an empty list. */
export function parseStackOperations(text: string): StackOperation[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseStackOperation);
}

function parseStackOperation(token: string): StackOperation {
  const parts = token.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if ((name === "pop" || name === "peek") && parts.length === 1) {
    return { op: name };
  }
  if (name === "push" && parts.length === 2) {
    const valueToken = parts[1];
    if (valueToken === undefined) {
      throw new Error(`"${token}" is not a push of one finite number.`);
    }
    return { op: "push", value: parseFiniteNumber(valueToken) };
  }
  throw new Error(`"${token}" is not a stack operation. Use "push 4", "pop", or "peek".`);
}

import type { QueueOperation } from "./algorithms/queue.ts";
import { parseFiniteNumber } from "./parse-numbers.ts";

/** Parse a comma- or newline-separated list of enqueue, dequeue, and peek. A blank field is an empty list. */
export function parseQueueOperations(text: string): QueueOperation[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseQueueOperation);
}

function parseQueueOperation(token: string): QueueOperation {
  const parts = token.split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if ((name === "dequeue" || name === "peek") && parts.length === 1) {
    return { op: name };
  }
  if (name === "enqueue" && parts.length === 2) {
    const valueToken = parts[1];
    if (valueToken === undefined) {
      throw new Error(`"${token}" is not an enqueue of one finite number.`);
    }
    return { op: "enqueue", value: parseFiniteNumber(valueToken) };
  }
  throw new Error(`"${token}" is not a queue operation. Use "enqueue 4", "dequeue", or "peek".`);
}

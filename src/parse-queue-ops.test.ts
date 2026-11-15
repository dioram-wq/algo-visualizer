import { describe, expect, it } from "vitest";
import { parseQueueOperations } from "./parse-queue-ops.ts";

describe("parseQueueOperations", () => {
  it("accepts commas, newlines, and a blank list", () => {
    expect(parseQueueOperations("enqueue 4, enqueue 9, peek, dequeue")).toEqual([
      { op: "enqueue", value: 4 },
      { op: "enqueue", value: 9 },
      { op: "peek" },
      { op: "dequeue" },
    ]);
    expect(parseQueueOperations("ENQUEUE -2\nPeek\ndequeue")).toEqual([
      { op: "enqueue", value: -2 },
      { op: "peek" },
      { op: "dequeue" },
    ]);
    expect(parseQueueOperations("")).toEqual([]);
    expect(parseQueueOperations("  ")).toEqual([]);
    expect(parseQueueOperations("enqueue +4, enqueue 0.5")).toEqual([
      { op: "enqueue", value: 4 },
      { op: "enqueue", value: 0.5 },
    ]);
  });

  it("rejects operations it cannot read", () => {
    expect(() => parseQueueOperations("shift")).toThrow(/shift/);
    expect(() => parseQueueOperations("enqueue")).toThrow(/enqueue/);
    expect(() => parseQueueOperations("enqueue 1 2")).toThrow(/enqueue 1 2/);
    expect(() => parseQueueOperations("dequeue 1")).toThrow(/dequeue 1/);
    expect(() => parseQueueOperations("enqueue Infinity")).toThrow(/finite/);
    expect(() => parseQueueOperations("enqueue nope")).toThrow(/nope/);
  });
});

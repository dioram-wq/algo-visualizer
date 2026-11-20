import { describe, expect, it } from "vitest";
import { heapSteps, type HeapStep } from "./algorithms/heap.ts";
import { DEFAULT_HEAP_OPERATIONS } from "./heap-view.ts";
import {
  heapFrame,
  heapNodeLabel,
  heapResultLabel,
  layoutHeap,
  HEAP_COLUMN_GAP,
  HEAP_LEVEL_GAP,
  HEAP_NODE_RADIUS,
  HEAP_PADDING,
} from "./heap-layout.ts";
import { parseHeapOperations } from "./parse-heap-ops.ts";

function xOf(column: number): number {
  return HEAP_PADDING + HEAP_NODE_RADIUS + column * HEAP_COLUMN_GAP;
}

function yOf(depth: number): number {
  return HEAP_PADDING + HEAP_NODE_RADIUS + depth * HEAP_LEVEL_GAP;
}

function box(gaps: number, gap: number): number {
  return HEAP_PADDING * 2 + HEAP_NODE_RADIUS * 2 + gaps * gap;
}

describe("layoutHeap", () => {
  it("returns an empty layout for an empty heap", () => {
    expect(layoutHeap([])).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it("places a single root in the padding box", () => {
    const values = Object.freeze([4]);
    const layout = layoutHeap(values);

    expect(layout.nodes).toEqual([
      { index: 0, value: 4, x: xOf(0), y: yOf(0), depth: 0, column: 0 },
    ]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(box(0, HEAP_COLUMN_GAP));
    expect(layout.height).toBe(box(0, HEAP_LEVEL_GAP));
    expect(values).toEqual([4]);
    expect(layout.nodes).not.toBe(values);
  });

  it("keeps a parent centered over its children, including a missing right child", () => {
    const pair = layoutHeap([1, 3]);
    const root = pair.nodes[0];
    const left = pair.nodes[1];
    expect(root).toMatchObject({ index: 0, value: 1, column: 0.5, depth: 0, x: xOf(0.5), y: yOf(0) });
    expect(left).toMatchObject({ index: 1, value: 3, column: 0, depth: 1, x: xOf(0), y: yOf(1) });
    expect(root?.x).toBe((left?.x ?? 0) + HEAP_COLUMN_GAP / 2);
    expect(pair.edges).toEqual([
      { parent: 0, child: 1, side: "left", x1: root?.x, y1: root?.y, x2: left?.x, y2: left?.y },
    ]);
    expect(pair.width).toBe(box(1, HEAP_COLUMN_GAP));
    expect(pair.height).toBe(box(1, HEAP_LEVEL_GAP));

    const grown = layoutHeap([1, 3, 2]);
    expect(grown.nodes[0]).toMatchObject({ x: root?.x, y: root?.y });
    expect(grown.nodes[1]).toMatchObject({ x: left?.x, y: left?.y });
    expect(grown.nodes[2]).toMatchObject({
      index: 2,
      value: 2,
      column: 1,
      depth: 1,
      x: xOf(1),
      y: yOf(1),
    });
    const right = grown.nodes[2];
    expect(grown.nodes[0]?.x).toBe(((grown.nodes[1]?.x ?? 0) + (right?.x ?? 0)) / 2);
    expect(grown.edges.map((edge) => [edge.parent, edge.child, edge.side])).toEqual([
      [0, 1, "left"],
      [0, 2, "right"],
    ]);
  });

  it("places a perfect tree so every parent is halfway between its children", () => {
    const values = Object.freeze([1, 3, 2, 7, 5, 6, 4]);
    const layout = layoutHeap(values);
    expect(layout.nodes.map((node) => [node.index, node.column, node.depth])).toEqual([
      [0, 1.5, 0],
      [1, 0.5, 1],
      [2, 2.5, 1],
      [3, 0, 2],
      [4, 1, 2],
      [5, 2, 2],
      [6, 3, 2],
    ]);
    expect(layout.width).toBe(box(3, HEAP_COLUMN_GAP));
    expect(layout.height).toBe(box(2, HEAP_LEVEL_GAP));
    for (const node of layout.nodes) {
      expect(node.x).toBe(xOf(node.column));
      expect(node.y).toBe(yOf(node.depth));
      expect(node.value).toBe(values[node.index]);
    }
    for (let index = 0; index <= 2; index += 1) {
      const parent = layout.nodes[index];
      const leftChild = layout.nodes[index * 2 + 1];
      const rightChild = layout.nodes[index * 2 + 2];
      expect(parent?.x).toBe(((leftChild?.x ?? 0) + (rightChild?.x ?? 0)) / 2);
      expect(leftChild?.y).toBe((parent?.y ?? 0) + HEAP_LEVEL_GAP);
      expect(rightChild?.y).toBe(leftChild?.y);
    }
    expect(layout.edges.map((edge) => [edge.child, edge.side])).toEqual([
      [1, "left"],
      [2, "right"],
      [3, "left"],
      [4, "right"],
      [5, "left"],
      [6, "right"],
    ]);
    expect(values).toEqual([1, 3, 2, 7, 5, 6, 4]);
  });

  it("tells equal values apart by index", () => {
    const layout = layoutHeap([2, 2]);
    expect(layout.nodes.map((node) => [node.index, node.value])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(layout.nodes[0]?.x).not.toBe(layout.nodes[1]?.x);
  });

  it("reserves the missing slots on the last level so filling one does not move the others", () => {
    const before = layoutHeap([1, 3, 2, 7]);
    const after = layoutHeap([1, 3, 2, 7, 5]);
    expect(after.nodes.slice(0, 4).map((node) => [node.x, node.y])).toEqual(
      before.nodes.map((node) => [node.x, node.y]),
    );
    expect(after.nodes[4]).toMatchObject({ index: 4, column: 1, depth: 2 });
    expect(after.width).toBe(before.width);
  });

  it("rejects a value that is not finite", () => {
    expect(() => layoutHeap([1, Number.NaN])).toThrow(/finite/);
    expect(() => layoutHeap([Number.POSITIVE_INFINITY])).toThrow(/finite/);
  });
});

describe("heapFrame", () => {
  const steps = heapSteps([
    { op: "insert", value: 5 },
    { op: "insert", value: 3 },
    { op: "insert", value: 8 },
    { op: "insert", value: 1 },
    { op: "extract-min" },
    { op: "peek" },
  ]);

  function stepWhere(predicate: (step: HeapStep) => boolean): HeapStep {
    const found = steps.find(predicate);
    if (found === undefined) throw new Error("missing step");
    return found;
  }

  it("highlights the indexes each step compares, swaps, inserts, or reads", () => {
    const start = heapFrame(stepWhere((step) => step.action === "start"));
    expect(start).toMatchObject({ empty: true, underflow: false, nodes: [], edges: [] });

    const root = heapFrame(stepWhere((step) => step.action === "insert" && step.value === 5));
    expect(root.empty).toBe(false);
    expect(root.nodes.map((node) => [node.index, node.value, node.mark])).toEqual([[0, 5, "insert"]]);
    expect(root.edges).toEqual([]);

    const sift = heapFrame(
      stepWhere((step) => step.action === "compare" && step.against === "parent" && step.value === 3),
    );
    expect(sift.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, "compare"],
      [1, "compare"],
    ]);
    expect(sift.edges.map((edge) => [edge.child, edge.marked])).toEqual([[1, true]]);

    const swapped = heapFrame(stepWhere((step) => step.action === "swap" && step.against === "parent"));
    expect(swapped.nodes.map((node) => [node.value, node.mark])).toEqual([
      [3, "swap"],
      [5, "swap"],
    ]);
    expect(swapped.edges.every((edge) => edge.marked)).toBe(true);

    const inserted = heapFrame(stepWhere((step) => step.action === "insert" && step.value === 8));
    expect(inserted.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, null],
      [1, null],
      [2, "insert"],
    ]);
    expect(inserted.edges.map((edge) => [edge.child, edge.marked])).toEqual([
      [1, false],
      [2, true],
    ]);

    const extracted = heapFrame(stepWhere((step) => step.action === "extract-min"));
    expect(extracted.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, "extract"],
      [1, null],
      [2, null],
      [3, null],
    ]);
    expect(extracted.edges.every((edge) => !edge.marked)).toBe(true);

    const moved = heapFrame(stepWhere((step) => step.action === "last-to-root"));
    expect(moved.nodes.map((node) => [node.index, node.value, node.mark])).toEqual([
      [0, 5, "move"],
      [1, 3, null],
      [2, 8, null],
    ]);
    expect(moved.edges.every((edge) => !edge.marked)).toBe(true);

    const children = heapFrame(
      stepWhere((step) => step.action === "compare" && step.against === "children"),
    );
    expect(children.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, null],
      [1, "compare"],
      [2, "compare"],
    ]);
    expect(children.edges.map((edge) => [edge.child, edge.marked])).toEqual([
      [1, true],
      [2, true],
    ]);

    const down = heapFrame(stepWhere((step) => step.action === "swap" && step.against === "child"));
    expect(down.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, "swap"],
      [1, "swap"],
      [2, null],
    ]);
    expect(down.edges.map((edge) => [edge.child, edge.marked])).toEqual([
      [1, true],
      [2, false],
    ]);

    const peeked = heapFrame(stepWhere((step) => step.action === "peek"));
    expect(peeked.underflow).toBe(false);
    expect(peeked.nodes.map((node) => [node.index, node.mark])).toEqual([
      [0, "peek"],
      [1, null],
      [2, null],
    ]);
    expect(peeked.edges.every((edge) => !edge.marked)).toBe(true);
  });

  it("shows an empty heap after the last value is extracted, and an underflow when the heap is already empty", () => {
    const extracted = heapSteps([
      { op: "insert", value: 2 },
      { op: "extract-min" },
    ]).find((step) => step.action === "extract-min");
    if (extracted === undefined) throw new Error("missing extract");
    expect(heapFrame(extracted)).toMatchObject({ empty: true, underflow: false, nodes: [], edges: [] });

    const missed = heapSteps([{ op: "peek" }]).find((step) => step.action === "underflow");
    if (missed === undefined) throw new Error("missing underflow");
    expect(heapFrame(missed)).toMatchObject({ empty: true, underflow: true, nodes: [], edges: [] });
  });

  it("rejects a step that points at the wrong index", () => {
    const missing: HeapStep = {
      values: [1, 2],
      action: "compare",
      operation: { op: "insert", value: 2 },
      value: 2,
      index: 5,
      other: 0,
      relation: "greater",
      against: "parent",
      message: "Compare 2 with 1.",
    };
    expect(() => heapFrame(missing)).toThrow(/missing index/);

    const siblings: HeapStep = {
      values: [1, 2, 3],
      action: "compare",
      operation: { op: "extract-min" },
      value: 2,
      index: 1,
      other: 2,
      relation: "less",
      against: "parent",
      message: "Compare the children.",
    };
    expect(() => heapFrame(siblings)).toThrow(/parent and child/);

    const misplaced: HeapStep = {
      values: [1, 2],
      action: "insert",
      operation: { op: "insert", value: 2 },
      value: 2,
      index: 0,
      other: null,
      relation: null,
      against: null,
      message: "Insert 2.",
    };
    expect(() => heapFrame(misplaced)).toThrow(/last index/);
  });
});

describe("heap labels", () => {
  it("names the caption and the highlighted index for each action", () => {
    expect(heapResultLabel({ action: "start", value: null, against: null, operation: null })).toBe("");
    expect(
      heapResultLabel({
        action: "insert",
        value: 5,
        against: null,
        operation: { op: "insert", value: 5 },
      }),
    ).toBe("inserted 5");
    expect(
      heapResultLabel({ action: "insert", value: null, against: null, operation: null }),
    ).toBe("");
    expect(
      heapResultLabel({
        action: "compare",
        value: 3,
        against: "parent",
        operation: { op: "insert", value: 3 },
      }),
    ).toBe("compare with parent");
    expect(
      heapResultLabel({
        action: "compare",
        value: 3,
        against: "child",
        operation: { op: "extract-min" },
      }),
    ).toBe("compare with child");
    expect(
      heapResultLabel({
        action: "compare",
        value: 3,
        against: "children",
        operation: { op: "extract-min" },
      }),
    ).toBe("compare children");
    expect(
      heapResultLabel({ action: "compare", value: 3, against: null, operation: null }),
    ).toBe("");
    expect(
      heapResultLabel({
        action: "swap",
        value: 3,
        against: "parent",
        operation: { op: "insert", value: 3 },
      }),
    ).toBe("sift up");
    expect(
      heapResultLabel({
        action: "swap",
        value: 5,
        against: "child",
        operation: { op: "extract-min" },
      }),
    ).toBe("sift down");
    expect(heapResultLabel({ action: "swap", value: 5, against: null, operation: null })).toBe("");
    expect(
      heapResultLabel({
        action: "extract-min",
        value: 1,
        against: null,
        operation: { op: "extract-min" },
      }),
    ).toBe("extracted 1");
    expect(
      heapResultLabel({
        action: "last-to-root",
        value: 5,
        against: null,
        operation: { op: "extract-min" },
      }),
    ).toBe("moved 5 to the root");
    expect(
      heapResultLabel({ action: "peek", value: 3, against: null, operation: { op: "peek" } }),
    ).toBe("peeked 3");
    expect(
      heapResultLabel({ action: "underflow", value: null, against: null, operation: { op: "peek" } }),
    ).toBe("peek underflow");
    expect(
      heapResultLabel({
        action: "underflow",
        value: null,
        against: null,
        operation: { op: "extract-min" },
      }),
    ).toBe("extract underflow");

    expect(heapNodeLabel(5, 0, null)).toBe("5 at index 0");
    expect(heapNodeLabel(3, 1, "compare")).toBe("3 at index 1, compared");
    expect(heapNodeLabel(3, 0, "swap")).toBe("3 at index 0, swapped");
    expect(heapNodeLabel(8, 2, "insert")).toBe("8 at index 2, inserted");
    expect(heapNodeLabel(1, 0, "extract")).toBe("1 at index 0, extracted");
    expect(heapNodeLabel(5, 0, "move")).toBe("5 at index 0, moved to the root");
    expect(heapNodeLabel(3, 0, "peek")).toBe("3 at index 0, peeked");
  });
});

describe("default heap trace", () => {
  it("includes an insert, a comparison, a swap, an extract-min, and a peek", () => {
    const steps = heapSteps(parseHeapOperations(DEFAULT_HEAP_OPERATIONS));
    expect(steps[0]?.action).toBe("start");
    expect(steps.some((step) => step.action === "insert")).toBe(true);
    expect(steps.some((step) => step.action === "compare" && step.against === "parent")).toBe(true);
    expect(steps.some((step) => step.action === "compare" && step.against === "children")).toBe(
      true,
    );
    expect(steps.some((step) => step.action === "swap")).toBe(true);
    expect(steps.some((step) => step.action === "extract-min")).toBe(true);
    expect(steps.some((step) => step.action === "last-to-root")).toBe(true);
    expect(steps.some((step) => step.action === "peek")).toBe(true);
    for (const step of steps) {
      expect(() => heapFrame(step)).not.toThrow();
    }
  });
});

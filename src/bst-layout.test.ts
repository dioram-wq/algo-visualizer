import { describe, expect, it } from "vitest";
import { bstSteps, type BstNode, type BstStep } from "./algorithms/bst.ts";
import { DEFAULT_BST_OPERATIONS } from "./bst-view.ts";
import {
  bstFrame,
  bstNodeLabel,
  bstResultLabel,
  layoutBst,
  BST_COLUMN_GAP,
  BST_LEVEL_GAP,
  BST_NODE_RADIUS,
  BST_PADDING,
} from "./bst-layout.ts";
import { parseBstOperations } from "./parse-bst-ops.ts";

function xOf(column: number): number {
  return BST_PADDING + BST_NODE_RADIUS + column * BST_COLUMN_GAP;
}

function yOf(depth: number): number {
  return BST_PADDING + BST_NODE_RADIUS + depth * BST_LEVEL_GAP;
}

function node(
  id: number,
  value: number,
  parent: number | null,
  left: number | null,
  right: number | null,
): BstNode {
  return { id, value, parent, left, right };
}

describe("layoutBst", () => {
  it("returns an empty layout for an empty tree", () => {
    expect(layoutBst([])).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it("places a single root in the padding box", () => {
    const nodes = Object.freeze([node(1, 4, null, null, null)]);
    const layout = layoutBst(nodes);

    expect(layout.nodes).toEqual([
      { id: 1, value: 4, x: xOf(0), y: yOf(0), depth: 0, column: 0 },
    ]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(BST_PADDING * 2 + BST_NODE_RADIUS * 2);
    expect(layout.height).toBe(BST_PADDING * 2 + BST_NODE_RADIUS * 2);
    expect(nodes[0]).toEqual(node(1, 4, null, null, null));
    expect(layout.nodes[0]).not.toBe(nodes[0]);
  });

  it("puts left children left of the parent and right children to the right, one level down", () => {
    const steps = bstSteps([
      { op: "insert", value: 8 },
      { op: "insert", value: 3 },
      { op: "insert", value: 10 },
      { op: "insert", value: 1 },
      { op: "insert", value: 6 },
    ]);
    const last = steps[steps.length - 1];
    if (last === undefined) throw new Error("expected a step");
    const layout = layoutBst(last.nodes);
    const byValue = new Map(layout.nodes.map((item) => [item.value, item]));
    const root = byValue.get(8);
    const left = byValue.get(3);
    const right = byValue.get(10);
    const leftLeft = byValue.get(1);
    const leftRight = byValue.get(6);
    expect(root).toBeDefined();
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(leftLeft).toBeDefined();
    expect(leftRight).toBeDefined();
    if (
      root === undefined ||
      left === undefined ||
      right === undefined ||
      leftLeft === undefined ||
      leftRight === undefined
    ) {
      return;
    }

    expect(left.x).toBeLessThan(root.x);
    expect(right.x).toBeGreaterThan(root.x);
    expect(leftLeft.x).toBeLessThan(left.x);
    expect(leftRight.x).toBeGreaterThan(left.x);
    expect(leftRight.x).toBeLessThan(root.x);
    expect(left.y).toBe(root.y + BST_LEVEL_GAP);
    expect(right.y).toBe(root.y + BST_LEVEL_GAP);
    expect(leftLeft.y).toBe(left.y + BST_LEVEL_GAP);
    expect(leftLeft).toMatchObject({ column: 0, depth: 2, x: xOf(0), y: yOf(2) });
    expect(left).toMatchObject({ column: 1, depth: 1, x: xOf(1), y: yOf(1) });
    expect(leftRight).toMatchObject({ column: 2, depth: 2, x: xOf(2), y: yOf(2) });
    expect(root).toMatchObject({ column: 3, depth: 0, x: xOf(3), y: yOf(0) });
    expect(right).toMatchObject({ column: 4, depth: 1, x: xOf(4), y: yOf(1) });
    expect(layout.width).toBe(BST_PADDING * 2 + BST_NODE_RADIUS * 2 + 4 * BST_COLUMN_GAP);
    expect(layout.height).toBe(BST_PADDING * 2 + BST_NODE_RADIUS * 2 + 2 * BST_LEVEL_GAP);
    expect(layout.edges).toEqual([
      { parentId: root.id, childId: left.id, side: "left", x1: root.x, y1: root.y, x2: left.x, y2: left.y },
      {
        parentId: root.id,
        childId: right.id,
        side: "right",
        x1: root.x,
        y1: root.y,
        x2: right.x,
        y2: right.y,
      },
      {
        parentId: left.id,
        childId: leftLeft.id,
        side: "left",
        x1: left.x,
        y1: left.y,
        x2: leftLeft.x,
        y2: leftLeft.y,
      },
      {
        parentId: left.id,
        childId: leftRight.id,
        side: "right",
        x1: left.x,
        y1: left.y,
        x2: leftRight.x,
        y2: leftRight.y,
      },
    ]);
  });

  it("rejects a tree that is not a single rooted shape", () => {
    expect(() =>
      layoutBst([node(1, 1, null, null, null), node(2, 2, null, null, null)]),
    ).toThrow(/one root/);
    expect(() => layoutBst([node(1, 1, 2, null, null)])).toThrow(/one root/);
    expect(() =>
      layoutBst([node(1, 1, null, 9, null), node(1, 2, null, null, null)]),
    ).toThrow(/repeated node id/);
    expect(() => layoutBst([node(1, 1, null, 2, null)])).toThrow(/missing a node/);
    expect(() =>
      layoutBst([node(1, 2, null, 2, null), node(2, 1, 9, null, null)]),
    ).toThrow(/left child does not point back/);
    expect(() =>
      layoutBst([node(1, 1, null, null, 2), node(2, 2, 9, null, null)]),
    ).toThrow(/right child does not point back/);
    expect(() =>
      layoutBst([
        node(1, 2, null, 2, null),
        node(2, 1, 1, null, null),
        node(3, 3, 1, null, null),
      ]),
    ).toThrow(/outside the tree/);
    expect(() =>
      layoutBst([node(1, 2, null, 2, 2), node(2, 1, 1, null, null)]),
    ).toThrow(/reaches a node twice/);
  });
});

describe("bstFrame", () => {
  const steps = bstSteps([
    { op: "insert", value: 8 },
    { op: "insert", value: 3 },
    { op: "insert", value: 8 },
    { op: "search", value: 3 },
    { op: "search", value: 7 },
  ]);

  function step(action: BstStep["action"], value?: number): BstStep {
    const found = steps.find(
      (item) => item.action === action && (value === undefined || item.value === value),
    );
    if (found === undefined) throw new Error(`missing ${action} step`);
    return found;
  }

  it("highlights the node each step is about and the edge just taken", () => {
    const start = bstFrame(step("start"));
    expect(start.empty).toBe(true);
    expect(start.missing).toBe(false);
    expect(start.nodes).toEqual([]);
    expect(start.edges).toEqual([]);

    const root = bstFrame(step("insert", 8));
    expect(root.empty).toBe(false);
    expect(root.nodes).toEqual([expect.objectContaining({ value: 8, mark: "insert" })]);
    expect(root.edges).toEqual([]);

    const compare = bstFrame(step("compare", 3));
    expect(compare.nodes.map((item) => [item.value, item.mark])).toEqual([[8, "compare"]]);
    expect(compare.edges.every((edge) => !edge.marked)).toBe(true);

    const placed = bstFrame(step("insert", 3));
    expect(placed.nodes.map((item) => [item.value, item.mark])).toEqual([
      [8, null],
      [3, "insert"],
    ]);
    expect(placed.edges.map((edge) => [edge.side, edge.marked])).toEqual([["left", true]]);

    const duplicate = bstFrame(step("duplicate", 8));
    expect(duplicate.nodes.map((item) => item.mark)).toEqual(["duplicate", null]);
    expect(duplicate.edges.every((edge) => !edge.marked)).toBe(true);

    const go = bstFrame(step("go-left", 3));
    expect(go.nodes.map((item) => [item.value, item.mark])).toEqual([
      [8, null],
      [3, "move"],
    ]);
    expect(go.edges.map((edge) => edge.marked)).toEqual([true]);

    const found = bstFrame(step("found", 3));
    expect(found.missing).toBe(false);
    expect(found.nodes.map((item) => [item.value, item.mark])).toEqual([
      [8, null],
      [3, "found"],
    ]);
    expect(found.edges.every((edge) => !edge.marked)).toBe(true);

    const miss = bstFrame(step("not-found", 7));
    expect(miss.missing).toBe(true);
    expect(miss.empty).toBe(false);
    expect(miss.nodes.map((item) => [item.value, item.mark])).toEqual([
      [8, null],
      [3, "missing"],
    ]);
    expect(miss.edges.every((edge) => !edge.marked)).toBe(true);
  });

  it("marks an empty-tree miss without a node", () => {
    const missed = bstSteps([{ op: "search", value: 4 }])[1];
    if (missed === undefined) throw new Error("expected a miss");
    const frame = bstFrame(missed);
    expect(frame).toMatchObject({ empty: true, missing: true, nodes: [], edges: [] });
  });

  it("rejects a step that points at the wrong node", () => {
    const broken: BstStep = {
      nodes: [node(1, 1, null, null, null)],
      action: "compare",
      operation: { op: "search", value: 1 },
      value: 1,
      nodeId: 9,
      relation: "equal",
      side: null,
      message: "Compare 1 with 1. The values are equal.",
    };
    expect(() => bstFrame(broken)).toThrow(/missing node/);

    const unmarked: BstStep = { ...broken, nodeId: null };
    expect(() => bstFrame(unmarked)).toThrow(/missing its node/);
  });
});

describe("bst labels", () => {
  it("names the caption and the highlighted node for each action", () => {
    expect(bstResultLabel({ action: "start", value: null })).toBe("");
    expect(bstResultLabel({ action: "compare", value: 3 })).toBe("compare 3");
    expect(bstResultLabel({ action: "compare", value: null })).toBe("");
    expect(bstResultLabel({ action: "go-left", value: 3 })).toBe("go left");
    expect(bstResultLabel({ action: "go-right", value: 10 })).toBe("go right");
    expect(bstResultLabel({ action: "insert", value: 8 })).toBe("inserted 8");
    expect(bstResultLabel({ action: "insert", value: null })).toBe("");
    expect(bstResultLabel({ action: "duplicate", value: 6 })).toBe("6 already in the tree");
    expect(bstResultLabel({ action: "found", value: 10 })).toBe("found 10");
    expect(bstResultLabel({ action: "not-found", value: 7 })).toBe("search missed");

    expect(bstNodeLabel(8, null)).toBe("8");
    expect(bstNodeLabel(3, "compare")).toBe("3, compared");
    expect(bstNodeLabel(3, "move")).toBe("3, visited");
    expect(bstNodeLabel(1, "insert")).toBe("1, inserted");
    expect(bstNodeLabel(6, "duplicate")).toBe("6, already in the tree");
    expect(bstNodeLabel(10, "found")).toBe("10, found");
    expect(bstNodeLabel(3, "missing")).toBe("3, search fell off here");
  });
});

describe("default binary search tree trace", () => {
  it("includes an insert, a duplicate, a hit, and a miss", () => {
    const steps = bstSteps(parseBstOperations(DEFAULT_BST_OPERATIONS));
    expect(steps.some((item) => item.action === "insert")).toBe(true);
    expect(steps.some((item) => item.action === "duplicate")).toBe(true);
    expect(steps.some((item) => item.action === "found")).toBe(true);
    expect(steps.some((item) => item.action === "not-found")).toBe(true);
    expect(steps[0]?.action).toBe("start");
  });
});

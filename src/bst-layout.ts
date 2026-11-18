import type { BstAction, BstNode, BstSide, BstStep } from "./algorithms/bst.ts";

/** Horizontal distance between neighboring inorder columns, in pixels. */
export const BST_COLUMN_GAP = 72;
/** Vertical distance between a node and its children, in pixels. */
export const BST_LEVEL_GAP = 80;
/** Radius of a drawn node, in pixels. Edges meet at the center. */
export const BST_NODE_RADIUS = 22;
/** Space around the outermost nodes, in pixels. */
export const BST_PADDING = 24;

export interface BstPoint {
  readonly id: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly column: number;
}

export interface BstEdge {
  readonly parentId: number;
  readonly childId: number;
  readonly side: BstSide;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface BstLayout {
  readonly nodes: readonly BstPoint[];
  readonly edges: readonly BstEdge[];
  readonly width: number;
  readonly height: number;
}

export type BstMark = "compare" | "move" | "insert" | "duplicate" | "found" | "missing";

export interface BstFrameNode extends BstPoint {
  readonly mark: BstMark | null;
}

export interface BstFrameEdge extends BstEdge {
  readonly marked: boolean;
}

export interface BstFrame {
  readonly nodes: readonly BstFrameNode[];
  readonly edges: readonly BstFrameEdge[];
  readonly width: number;
  readonly height: number;
  readonly empty: boolean;
  readonly missing: boolean;
}

/**
 * Place each node by its inorder column and depth, so a left child sits left
 * of its parent and a right child sits right of it. An empty tree has no nodes.
 * The input nodes are not mutated.
 */
export function layoutBst(nodes: readonly BstNode[]): BstLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const byId = new Map<number, BstNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      throw new RangeError("A binary search tree layout has a repeated node id.");
    }
    byId.set(node.id, node);
  }

  const roots = nodes.filter((node) => node.parent === null);
  if (roots.length !== 1) {
    throw new RangeError("A binary search tree layout needs one root.");
  }
  const root = roots[0];
  if (root === undefined) {
    throw new RangeError("A binary search tree layout needs one root.");
  }

  for (const node of nodes) {
    checkChild(byId, node, node.left, "left");
    checkChild(byId, node, node.right, "right");
  }

  const columns = new Map<number, number>();
  const depths = new Map<number, number>();
  const seen = new Set<number>();
  let nextColumn = 0;

  const visit = (id: number, depth: number): void => {
    if (seen.has(id)) {
      throw new RangeError("A binary search tree layout reaches a node twice.");
    }
    const node = byId.get(id);
    if (node === undefined) {
      throw new RangeError("A binary search tree layout is missing a node.");
    }
    seen.add(id);
    if (node.left !== null) visit(node.left, depth + 1);
    columns.set(id, nextColumn);
    depths.set(id, depth);
    nextColumn += 1;
    if (node.right !== null) visit(node.right, depth + 1);
  };

  visit(root.id, 0);
  if (seen.size !== nodes.length) {
    throw new RangeError("A binary search tree layout has a node outside the tree.");
  }

  const points = new Map<number, { x: number; y: number }>();
  let maxDepth = 0;
  const placed: BstPoint[] = nodes.map((node) => {
    const column = columns.get(node.id);
    const depth = depths.get(node.id);
    if (column === undefined || depth === undefined) {
      throw new RangeError("A binary search tree layout lost a node.");
    }
    if (depth > maxDepth) maxDepth = depth;
    const point = at(column, depth);
    points.set(node.id, point);
    return { id: node.id, value: node.value, x: point.x, y: point.y, depth, column };
  });

  const edges: BstEdge[] = [];
  for (const node of nodes) {
    if (node.left !== null) edges.push(link(node.id, node.left, "left", points));
    if (node.right !== null) edges.push(link(node.id, node.right, "right", points));
  }

  return {
    nodes: placed,
    edges,
    width: span(nextColumn, BST_COLUMN_GAP),
    height: span(maxDepth + 1, BST_LEVEL_GAP),
  };
}

/** Map one generator step onto layout positions and the node that step highlights. */
export function bstFrame(step: BstStep): BstFrame {
  const layout = layoutBst(step.nodes);
  if (step.action !== "start" && step.action !== "not-found" && step.nodeId === null) {
    throw new RangeError("A binary search tree step is missing its node.");
  }
  if (step.nodeId !== null && !layout.nodes.some((node) => node.id === step.nodeId)) {
    throw new RangeError("A binary search tree step points at a missing node.");
  }
  const mark = markFor(step.action, step.nodeId);
  const markedChild = childToMark(step);

  return {
    nodes: layout.nodes.map((node) => ({
      ...node,
      mark: node.id === step.nodeId ? mark : null,
    })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      marked: markedChild !== null && edge.childId === markedChild,
    })),
    width: layout.width,
    height: layout.height,
    empty: layout.nodes.length === 0,
    missing: step.action === "not-found",
  };
}

/** Short caption under the tree for the current step. */
export function bstResultLabel(step: Pick<BstStep, "action" | "value">): string {
  switch (step.action) {
    case "start":
      return "";
    case "compare":
      return step.value === null ? "" : `compare ${step.value}`;
    case "go-left":
      return "go left";
    case "go-right":
      return "go right";
    case "insert":
      return step.value === null ? "" : `inserted ${step.value}`;
    case "duplicate":
      return step.value === null ? "" : `${step.value} already in the tree`;
    case "found":
      return step.value === null ? "" : `found ${step.value}`;
    case "not-found":
      return "search missed";
    default: {
      const unexpected: never = step.action;
      throw new Error(`Unexpected binary search tree action: ${String(unexpected)}`);
    }
  }
}

/** Accessible name for one drawn node, including why it is highlighted. */
export function bstNodeLabel(value: number, mark: BstMark | null): string {
  const text = String(value);
  switch (mark) {
    case null:
      return text;
    case "compare":
      return `${text}, compared`;
    case "move":
      return `${text}, visited`;
    case "insert":
      return `${text}, inserted`;
    case "duplicate":
      return `${text}, already in the tree`;
    case "found":
      return `${text}, found`;
    case "missing":
      return `${text}, search fell off here`;
    default: {
      const unexpected: never = mark;
      throw new Error(`Unexpected binary search tree mark: ${String(unexpected)}`);
    }
  }
}

function at(column: number, depth: number): { x: number; y: number } {
  return {
    x: BST_PADDING + BST_NODE_RADIUS + column * BST_COLUMN_GAP,
    y: BST_PADDING + BST_NODE_RADIUS + depth * BST_LEVEL_GAP,
  };
}

function span(count: number, gap: number): number {
  return BST_PADDING * 2 + BST_NODE_RADIUS * 2 + (count - 1) * gap;
}

function checkChild(
  byId: ReadonlyMap<number, BstNode>,
  parent: BstNode,
  childId: number | null,
  side: BstSide,
): void {
  if (childId === null) return;
  const child = byId.get(childId);
  if (child === undefined) {
    throw new RangeError("A binary search tree layout is missing a node.");
  }
  if (child.parent !== parent.id) {
    throw new RangeError(`A ${side} child does not point back at its parent.`);
  }
}

function link(
  parentId: number,
  childId: number,
  side: BstSide,
  points: ReadonlyMap<number, { x: number; y: number }>,
): BstEdge {
  const from = points.get(parentId);
  const to = points.get(childId);
  if (from === undefined || to === undefined) {
    throw new RangeError("A binary search tree layout lost a node.");
  }
  return { parentId, childId, side, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

function markFor(action: BstAction, nodeId: number | null): BstMark | null {
  switch (action) {
    case "start":
      return null;
    case "compare":
      return "compare";
    case "go-left":
    case "go-right":
      return "move";
    case "insert":
      return "insert";
    case "duplicate":
      return "duplicate";
    case "found":
      return "found";
    case "not-found":
      return nodeId === null ? null : "missing";
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected binary search tree action: ${String(unexpected)}`);
    }
  }
}

function childToMark(step: BstStep): number | null {
  if (step.nodeId === null) return null;
  if (step.action !== "go-left" && step.action !== "go-right" && step.action !== "insert") {
    return null;
  }
  const node = step.nodes.find((item) => item.id === step.nodeId);
  if (node === undefined || node.parent === null) return null;
  return node.id;
}

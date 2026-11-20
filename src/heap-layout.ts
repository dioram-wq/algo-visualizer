import type { HeapStep } from "./algorithms/heap.ts";

/** Horizontal distance between neighboring slots of a perfect tree, in pixels. */
export const HEAP_COLUMN_GAP = 72;
/** Vertical distance between a node and its children, in pixels. */
export const HEAP_LEVEL_GAP = 80;
/** Radius of a drawn node, in pixels. Edges meet at the center. */
export const HEAP_NODE_RADIUS = 22;
/** Space around the outermost nodes, in pixels. */
export const HEAP_PADDING = 24;

export interface HeapPoint {
  readonly index: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** Slot in the perfect tree of this depth. A parent can sit on a half slot. */
  readonly column: number;
}

export interface HeapEdge {
  readonly parent: number;
  readonly child: number;
  readonly side: "left" | "right";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface HeapLayout {
  readonly nodes: readonly HeapPoint[];
  readonly edges: readonly HeapEdge[];
  readonly width: number;
  readonly height: number;
}

export type HeapMark = "compare" | "swap" | "insert" | "extract" | "move" | "peek";

export interface HeapFrameNode extends HeapPoint {
  readonly mark: HeapMark | null;
}

export interface HeapFrameEdge extends HeapEdge {
  readonly marked: boolean;
}

export interface HeapFrame {
  readonly nodes: readonly HeapFrameNode[];
  readonly edges: readonly HeapFrameEdge[];
  readonly width: number;
  readonly height: number;
  readonly empty: boolean;
  readonly underflow: boolean;
}

/**
 * Place a binary heap as a complete tree.
 * Index 0 is the root. The children of index i are 2i + 1 and 2i + 2.
 * Each node sits in the slot it would occupy in a perfect tree of the same
 * depth, so a parent stays centered over its children when the right child
 * is missing. An empty heap has no nodes. The input array is not mutated.
 * Nodes are returned in index order.
 */
export function layoutHeap(values: readonly number[]): HeapLayout {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("A heap layout expects finite numbers.");
  }
  if (values.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const maxDepth = depthOf(values.length - 1);
  const leftmost = 0.5;
  const nodes: HeapPoint[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const depth = depthOf(index);
    const offset = index - (pow2(depth) - 1);
    const center = (offset + 0.5) * pow2(maxDepth - depth);
    const column = center - leftmost;
    const value = values[index];
    if (value === undefined) {
      throw new RangeError("A heap layout expects finite numbers.");
    }
    nodes.push({
      index,
      value,
      x: atX(column),
      y: atY(depth),
      depth,
      column,
    });
  }

  const points = new Map(nodes.map((node) => [node.index, node]));
  const edges: HeapEdge[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left < values.length) edges.push(link(index, left, "left", points));
    if (right < values.length) edges.push(link(index, right, "right", points));
  }

  return {
    nodes,
    edges,
    width: span(pow2(maxDepth) - 1, HEAP_COLUMN_GAP),
    height: span(maxDepth, HEAP_LEVEL_GAP),
  };
}

/** Map one generator step onto layout positions and the indexes that step highlights. */
export function heapFrame(step: HeapStep): HeapFrame {
  const layout = layoutHeap(step.values);
  const highlight = highlightFor(step, step.values.length);
  return {
    nodes: layout.nodes.map((node) => ({
      ...node,
      mark: highlight.marks.get(node.index) ?? null,
    })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      marked: highlight.edges.has(edge.child),
    })),
    width: layout.width,
    height: layout.height,
    empty: layout.nodes.length === 0,
    underflow: step.action === "underflow",
  };
}

/** Short caption under the tree for the current step. */
export function heapResultLabel(
  step: Pick<HeapStep, "action" | "value" | "against" | "operation">,
): string {
  switch (step.action) {
    case "start":
      return "";
    case "insert":
      return step.value === null ? "" : `inserted ${step.value}`;
    case "compare":
      if (step.against === "children") return "compare children";
      if (step.against === "parent") return "compare with parent";
      if (step.against === "child") return "compare with child";
      return "";
    case "swap":
      if (step.against === "parent") return "sift up";
      if (step.against === "child") return "sift down";
      return "";
    case "extract-min":
      return step.value === null ? "" : `extracted ${step.value}`;
    case "last-to-root":
      return step.value === null ? "" : `moved ${step.value} to the root`;
    case "peek":
      return step.value === null ? "" : `peeked ${step.value}`;
    case "underflow":
      return step.operation?.op === "peek" ? "peek underflow" : "extract underflow";
    default: {
      const unexpected: never = step.action;
      throw new Error(`Unexpected heap action: ${String(unexpected)}`);
    }
  }
}

/** Accessible name for one drawn node or array cell, including why it is highlighted. */
export function heapNodeLabel(value: number, index: number, mark: HeapMark | null): string {
  const text = `${value} at index ${index}`;
  switch (mark) {
    case null:
      return text;
    case "compare":
      return `${text}, compared`;
    case "swap":
      return `${text}, swapped`;
    case "insert":
      return `${text}, inserted`;
    case "extract":
      return `${text}, extracted`;
    case "move":
      return `${text}, moved to the root`;
    case "peek":
      return `${text}, peeked`;
    default: {
      const unexpected: never = mark;
      throw new Error(`Unexpected heap mark: ${String(unexpected)}`);
    }
  }
}

function atX(column: number): number {
  return HEAP_PADDING + HEAP_NODE_RADIUS + column * HEAP_COLUMN_GAP;
}

function atY(depth: number): number {
  return HEAP_PADDING + HEAP_NODE_RADIUS + depth * HEAP_LEVEL_GAP;
}

function span(gaps: number, gap: number): number {
  return HEAP_PADDING * 2 + HEAP_NODE_RADIUS * 2 + gaps * gap;
}

function depthOf(index: number): number {
  let depth = 0;
  let cursor = index + 1;
  while (cursor > 1) {
    cursor = Math.floor(cursor / 2);
    depth += 1;
  }
  return depth;
}

function pow2(exponent: number): number {
  let value = 1;
  for (let count = 0; count < exponent; count += 1) value *= 2;
  return value;
}

function link(
  parent: number,
  child: number,
  side: "left" | "right",
  points: ReadonlyMap<number, HeapPoint>,
): HeapEdge {
  const from = points.get(parent);
  const to = points.get(child);
  if (from === undefined || to === undefined) {
    throw new RangeError("A heap layout lost a node.");
  }
  return { parent, child, side, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

interface Highlight {
  readonly marks: ReadonlyMap<number, HeapMark>;
  readonly edges: ReadonlySet<number>;
}

function highlightFor(step: HeapStep, length: number): Highlight {
  const marks = new Map<number, HeapMark>();
  const edges = new Set<number>();
  switch (step.action) {
    case "start":
      return { marks, edges };
    case "underflow":
      if (length !== 0) throw new RangeError("An underflow step is not an empty heap.");
      return { marks, edges };
    case "insert": {
      const index = liveIndex(step.index, length);
      if (index !== length - 1) {
        throw new RangeError("An insert step does not point at the new last index.");
      }
      marks.set(index, "insert");
      if (index > 0) edges.add(index);
      return { marks, edges };
    }
    case "compare":
    case "swap":
      return highlightPair(step, length, step.action);
    case "extract-min":
      if (length === 0) return { marks, edges };
      markRoot(marks, step.index, length, "extract");
      return { marks, edges };
    case "last-to-root":
      markRoot(marks, step.index, length, "move");
      return { marks, edges };
    case "peek":
      markRoot(marks, step.index, length, "peek");
      return { marks, edges };
    default: {
      const unexpected: never = step.action;
      throw new Error(`Unexpected heap action: ${String(unexpected)}`);
    }
  }
}

function highlightPair(step: HeapStep, length: number, mark: "compare" | "swap"): Highlight {
  const index = liveIndex(step.index, length);
  const other = liveIndex(step.other, length);
  const marks = new Map<number, HeapMark>([
    [index, mark],
    [other, mark],
  ]);
  const edges = new Set<number>();
  if (step.against === "children") {
    if (mark === "swap") {
      throw new RangeError("A heap swap is not a comparison of the two children.");
    }
    assertSiblings(index, other);
    edges.add(index);
    edges.add(other);
    return { marks, edges };
  }
  if (step.against === "parent" || step.against === "child") {
    edges.add(childEnd(index, other));
    return { marks, edges };
  }
  throw new RangeError("A heap step is missing its direction.");
}

function markRoot(
  marks: Map<number, HeapMark>,
  index: number | null,
  length: number,
  mark: HeapMark,
): void {
  const root = liveIndex(index, length);
  if (root !== 0) throw new RangeError("A heap step does not point at the root.");
  marks.set(root, mark);
}

function liveIndex(index: number | null, length: number): number {
  if (index === null || !Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError("A heap step points at a missing index.");
  }
  return index;
}

function childEnd(index: number, other: number): number {
  const parent = Math.min(index, other);
  const child = Math.max(index, other);
  if (Math.floor((child - 1) / 2) !== parent) {
    throw new RangeError("A heap step joins indexes that are not parent and child.");
  }
  return child;
}

function assertSiblings(index: number, other: number): void {
  const low = Math.min(index, other);
  const high = Math.max(index, other);
  if (high !== low + 1 || low % 2 === 0) {
    throw new RangeError("A heap step compares indexes that are not sibling children.");
  }
}

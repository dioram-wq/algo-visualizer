export type BstOperation =
  | { readonly op: "insert"; readonly value: number }
  | { readonly op: "search"; readonly value: number };

export type BstAction =
  | "start"
  | "compare"
  | "go-left"
  | "go-right"
  | "insert"
  | "duplicate"
  | "found"
  | "not-found";

export type BstRelation = "less" | "greater" | "equal";

export type BstSide = "left" | "right";

export interface BstNode {
  /** Stable id assigned at insertion, starting at 1. */
  readonly id: number;
  readonly value: number;
  /** Id of the parent. Null for the root. */
  readonly parent: number | null;
  /** Id of the left child. Null when there is none. */
  readonly left: number | null;
  /** Id of the right child. Null when there is none. */
  readonly right: number | null;
}

export interface BstStep {
  /** Nodes after this step, in insertion order. */
  readonly nodes: readonly BstNode[];
  readonly action: BstAction;
  /** The operation that produced this step. Null on the opening snapshot. */
  readonly operation: BstOperation | null;
  /** Value being inserted or searched. Null on the opening snapshot. */
  readonly value: number | null;
  /**
   * Node this step is about: the compared node, the child just moved to,
   * the inserted node, the found node, or the node a search fell off.
   * Null on the opening snapshot and when a search misses an empty tree.
   */
  readonly nodeId: number | null;
  /** Comparison result. Set on compare steps only. */
  readonly relation: BstRelation | null;
  /**
   * Left or right. Set when the walk moves to an existing child, when a new
   * node is attached under a parent, and when a search falls off that side.
   * Null for the root insert and for steps that do not choose a side.
   */
  readonly side: BstSide | null;
  readonly message: string;
}

interface MutableNode {
  id: number;
  value: number;
  parent: MutableNode | null;
  left: MutableNode | null;
  right: MutableNode | null;
}

interface Trace {
  root: MutableNode | null;
  live: MutableNode[];
  nodes: readonly BstNode[];
  nextId: number;
  steps: BstStep[];
}

/**
 * Record a binary search tree as values are inserted and searched.
 * The caller's operations are copied, and each snapshot is frozen, so later
 * edits do not rewrite old steps.
 *
 * Insert walks from the root. A smaller value goes left and a larger value
 * goes right. The new node is added when that child is missing. The first
 * insert in an empty tree becomes the root, with no comparison.
 *
 * Duplicates are not inserted. An equal value stops the walk at the node
 * already holding it, the tree stays as it was, and the step is marked
 * duplicate. The shape therefore depends only on the first time each value
 * is inserted. Search uses the same comparisons and reports found or not-found.
 * A search in an empty tree misses immediately.
 */
export function bstSteps(operations: readonly BstOperation[]): BstStep[] {
  const trace: Trace = {
    root: null,
    live: [],
    nodes: snapshot([]),
    nextId: 1,
    steps: [],
  };
  trace.steps.push(step(trace.nodes, "start", null, null, null, null, null));

  for (const operation of operations) {
    const recorded = copyOperation(operation);
    if (recorded.op === "insert") insertValue(trace, recorded);
    else searchValue(trace, recorded);
  }

  return trace.steps;
}

function insertValue(trace: Trace, operation: BstOperation & { op: "insert" }): void {
  const value = operation.value;
  if (trace.root === null) {
    const created = createNode(trace, value, null);
    trace.root = created;
    trace.nodes = snapshot(trace.live);
    trace.steps.push(step(trace.nodes, "insert", operation, value, created.id, null, null));
    return;
  }

  let current = trace.root;
  while (true) {
    const relation = relate(value, current.value);
    trace.steps.push(step(trace.nodes, "compare", operation, value, current.id, relation, null));
    if (relation === "equal") {
      trace.steps.push(step(trace.nodes, "duplicate", operation, value, current.id, null, null));
      return;
    }
    const side: BstSide = relation === "less" ? "left" : "right";
    const child = side === "left" ? current.left : current.right;
    if (child === null) {
      const created = createNode(trace, value, current);
      if (side === "left") current.left = created;
      else current.right = created;
      trace.nodes = snapshot(trace.live);
      trace.steps.push(step(trace.nodes, "insert", operation, value, created.id, null, side));
      return;
    }
    trace.steps.push(
      step(trace.nodes, side === "left" ? "go-left" : "go-right", operation, value, child.id, null, side),
    );
    current = child;
  }
}

function searchValue(trace: Trace, operation: BstOperation & { op: "search" }): void {
  const value = operation.value;
  if (trace.root === null) {
    trace.steps.push(step(trace.nodes, "not-found", operation, value, null, null, null));
    return;
  }

  let current = trace.root;
  while (true) {
    const relation = relate(value, current.value);
    trace.steps.push(step(trace.nodes, "compare", operation, value, current.id, relation, null));
    if (relation === "equal") {
      trace.steps.push(step(trace.nodes, "found", operation, value, current.id, null, null));
      return;
    }
    const side: BstSide = relation === "less" ? "left" : "right";
    const child = side === "left" ? current.left : current.right;
    if (child === null) {
      trace.steps.push(step(trace.nodes, "not-found", operation, value, current.id, null, side));
      return;
    }
    trace.steps.push(
      step(trace.nodes, side === "left" ? "go-left" : "go-right", operation, value, child.id, null, side),
    );
    current = child;
  }
}

function createNode(trace: Trace, value: number, parent: MutableNode | null): MutableNode {
  const node: MutableNode = {
    id: trace.nextId,
    value,
    parent,
    left: null,
    right: null,
  };
  trace.nextId += 1;
  trace.live.push(node);
  return node;
}

function relate(value: number, nodeValue: number): BstRelation {
  if (value < nodeValue) return "less";
  if (value > nodeValue) return "greater";
  return "equal";
}

function copyOperation(operation: BstOperation): BstOperation {
  const record = operation as { op?: unknown; value?: unknown } | null;
  if (record !== null && typeof record === "object") {
    if (record.op === "insert" || record.op === "search") {
      if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
        throw new RangeError("bstSteps expects finite numbers.");
      }
      return Object.freeze({ op: record.op, value: record.value });
    }
  }
  throw new RangeError("bstSteps expects insert or search operations.");
}

function snapshot(live: readonly MutableNode[]): readonly BstNode[] {
  return Object.freeze(
    live.map((node) =>
      Object.freeze({
        id: node.id,
        value: node.value,
        parent: node.parent === null ? null : node.parent.id,
        left: node.left === null ? null : node.left.id,
        right: node.right === null ? null : node.right.id,
      }),
    ),
  );
}

function step(
  nodes: readonly BstNode[],
  action: BstAction,
  operation: BstOperation | null,
  value: number | null,
  nodeId: number | null,
  relation: BstRelation | null,
  side: BstSide | null,
): BstStep {
  return {
    nodes,
    action,
    operation,
    value,
    nodeId,
    relation,
    side,
    message: describe(nodes, action, value, nodeId, relation, side),
  };
}

function describe(
  nodes: readonly BstNode[],
  action: BstAction,
  value: number | null,
  nodeId: number | null,
  relation: BstRelation | null,
  side: BstSide | null,
): string {
  switch (action) {
    case "start":
      return "Start with an empty tree.";
    case "compare":
      return describeCompare(nodes, requireValue(value), requireNodeId(nodeId), requireRelation(relation));
    case "go-left":
      return describeGo(nodes, requireNodeId(nodeId), "left");
    case "go-right":
      return describeGo(nodes, requireNodeId(nodeId), "right");
    case "insert":
      return describeInsert(nodes, requireValue(value), requireNodeId(nodeId), side);
    case "duplicate":
      return `${formatValue(requireValue(value))} is already in the tree. The duplicate is not inserted.`;
    case "found":
      return `Search finds ${formatValue(requireValue(value))}.`;
    case "not-found":
      return describeNotFound(nodes, requireValue(value), nodeId, side);
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected binary search tree action: ${String(unexpected)}`);
    }
  }
}

function describeCompare(
  nodes: readonly BstNode[],
  value: number,
  nodeId: number,
  relation: BstRelation,
): string {
  const node = nodeById(nodes, nodeId);
  const incoming = formatValue(value);
  const current = formatValue(node.value);
  if (relation === "less") return `Compare ${incoming} with ${current}. ${incoming} is less than ${current}.`;
  if (relation === "greater") {
    return `Compare ${incoming} with ${current}. ${incoming} is greater than ${current}.`;
  }
  return `Compare ${incoming} with ${current}. The values are equal.`;
}

function describeGo(nodes: readonly BstNode[], nodeId: number, side: BstSide): string {
  const child = nodeById(nodes, nodeId);
  if (child.parent === null) {
    throw new RangeError("A move step is missing its parent.");
  }
  const parent = nodeById(nodes, child.parent);
  const linked = side === "left" ? parent.left : parent.right;
  if (linked !== child.id) {
    throw new RangeError("A move step does not follow that child.");
  }
  return `Go ${side} from ${formatValue(parent.value)} to ${formatValue(child.value)}.`;
}

function describeInsert(
  nodes: readonly BstNode[],
  value: number,
  nodeId: number,
  side: BstSide | null,
): string {
  const node = nodeById(nodes, nodeId);
  const incoming = formatValue(value);
  if (node.parent === null) {
    if (side !== null) throw new RangeError("The root insert has no side.");
    return `Insert ${incoming} as the root.`;
  }
  if (side === null) throw new RangeError("An insert under a parent is missing its side.");
  const parent = nodeById(nodes, node.parent);
  const linked = side === "left" ? parent.left : parent.right;
  if (linked !== node.id) throw new RangeError("An insert step does not match that child.");
  return `Insert ${incoming} as the ${side} child of ${formatValue(parent.value)}.`;
}

function describeNotFound(
  nodes: readonly BstNode[],
  value: number,
  nodeId: number | null,
  side: BstSide | null,
): string {
  const incoming = formatValue(value);
  if (nodeId === null) {
    if (side !== null) throw new RangeError("An empty-tree miss has no side.");
    return `Search an empty tree for ${incoming}. It is not there.`;
  }
  if (side === null) throw new RangeError("A search miss is missing the side it fell off.");
  const node = nodeById(nodes, nodeId);
  const current = formatValue(node.value);
  const direction = side === "left" ? "less" : "greater";
  return `Search for ${incoming}. ${incoming} is ${direction} than ${current}, and ${current} has no ${side} child, so ${incoming} is not in the tree.`;
}

function requireValue(value: number | null): number {
  if (value === null) throw new RangeError("A binary search tree step is missing its value.");
  return value;
}

function requireNodeId(nodeId: number | null): number {
  if (nodeId === null) throw new RangeError("A binary search tree step is missing its node.");
  return nodeId;
}

function requireRelation(relation: BstRelation | null): BstRelation {
  if (relation === null) throw new RangeError("A comparison step is missing its result.");
  return relation;
}

function nodeById(nodes: readonly BstNode[], id: number): BstNode {
  const node = nodes.find((item) => item.id === id);
  if (node === undefined) {
    throw new RangeError("A binary search tree step points at a missing node.");
  }
  return node;
}

function formatValue(value: number): string {
  return String(value);
}

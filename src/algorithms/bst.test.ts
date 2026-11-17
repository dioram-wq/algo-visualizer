import { describe, expect, it } from "vitest";
import { bstSteps, type BstNode, type BstOperation, type BstStep } from "./bst.ts";

function project(steps: readonly BstStep[]) {
  return steps.map((current) => ({
    action: current.action,
    operation: current.operation === null ? null : { ...current.operation },
    value: current.value,
    nodeId: current.nodeId,
    relation: current.relation,
    side: current.side,
    size: current.nodes.length,
  }));
}

function row(
  action: BstStep["action"],
  value: number | null,
  nodeId: number | null,
  relation: BstStep["relation"],
  side: BstStep["side"],
  size: number,
  operation: BstOperation | null = null,
) {
  return { action, operation, value, nodeId, relation, side, size };
}

const SHAPE: readonly BstNode[] = [
  { id: 1, value: 8, parent: null, left: 2, right: 3 },
  { id: 2, value: 3, parent: 1, left: 4, right: 5 },
  { id: 3, value: 10, parent: 1, left: null, right: 6 },
  { id: 4, value: 1, parent: 2, left: null, right: null },
  { id: 5, value: 6, parent: 2, left: 7, right: 8 },
  { id: 6, value: 14, parent: 3, left: 9, right: null },
  { id: 7, value: 4, parent: 5, left: null, right: null },
  { id: 8, value: 7, parent: 5, left: null, right: null },
  { id: 9, value: 13, parent: 6, left: null, right: null },
];

function inorder(nodes: readonly BstNode[]): number[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => node.parent === null);
  if (nodes.length === 0) return [];
  if (roots.length !== 1) throw new Error("The tree should have one root.");
  const root = roots[0];
  if (root === undefined) throw new Error("The tree should have one root.");
  const values: number[] = [];
  const visit = (id: number | null, lower: number | null, upper: number | null): void => {
    if (id === null) return;
    const node = byId.get(id);
    if (node === undefined) throw new Error("The tree is missing a node.");
    if (lower !== null && node.value <= lower) {
      throw new Error("A left-side value is not smaller than its ancestor.");
    }
    if (upper !== null && node.value >= upper) {
      throw new Error("A right-side value is not larger than its ancestor.");
    }
    if (node.left !== null) {
      const left = byId.get(node.left);
      if (left?.parent !== node.id) throw new Error("A left child does not point back at its parent.");
    }
    if (node.right !== null) {
      const right = byId.get(node.right);
      if (right?.parent !== node.id) throw new Error("A right child does not point back at its parent.");
    }
    visit(node.left, lower, node.value);
    values.push(node.value);
    visit(node.right, node.value, upper);
  };
  visit(root.id, null, null);
  return values;
}

describe("bstSteps", () => {
  it("inserts values in order and records the resulting tree shape", () => {
    const values = [8, 3, 10, 1, 6, 14, 4, 7, 13];
    const steps = bstSteps([
      ...values.map((value) => ({ op: "insert" as const, value })),
      { op: "search", value: 4 },
      { op: "search", value: 6 },
      { op: "search", value: 8 },
      { op: "search", value: 5 },
      { op: "search", value: 15 },
    ]);

    const insert = (value: number): BstOperation => ({ op: "insert", value });
    const search = (value: number): BstOperation => ({ op: "search", value });
    expect(project(steps)).toEqual([
      row("start", null, null, null, null, 0),
      row("insert", 8, 1, null, null, 1, insert(8)),
      row("compare", 3, 1, "less", null, 1, insert(3)),
      row("insert", 3, 2, null, "left", 2, insert(3)),
      row("compare", 10, 1, "greater", null, 2, insert(10)),
      row("insert", 10, 3, null, "right", 3, insert(10)),
      row("compare", 1, 1, "less", null, 3, insert(1)),
      row("go-left", 1, 2, null, "left", 3, insert(1)),
      row("compare", 1, 2, "less", null, 3, insert(1)),
      row("insert", 1, 4, null, "left", 4, insert(1)),
      row("compare", 6, 1, "less", null, 4, insert(6)),
      row("go-left", 6, 2, null, "left", 4, insert(6)),
      row("compare", 6, 2, "greater", null, 4, insert(6)),
      row("insert", 6, 5, null, "right", 5, insert(6)),
      row("compare", 14, 1, "greater", null, 5, insert(14)),
      row("go-right", 14, 3, null, "right", 5, insert(14)),
      row("compare", 14, 3, "greater", null, 5, insert(14)),
      row("insert", 14, 6, null, "right", 6, insert(14)),
      row("compare", 4, 1, "less", null, 6, insert(4)),
      row("go-left", 4, 2, null, "left", 6, insert(4)),
      row("compare", 4, 2, "greater", null, 6, insert(4)),
      row("go-right", 4, 5, null, "right", 6, insert(4)),
      row("compare", 4, 5, "less", null, 6, insert(4)),
      row("insert", 4, 7, null, "left", 7, insert(4)),
      row("compare", 7, 1, "less", null, 7, insert(7)),
      row("go-left", 7, 2, null, "left", 7, insert(7)),
      row("compare", 7, 2, "greater", null, 7, insert(7)),
      row("go-right", 7, 5, null, "right", 7, insert(7)),
      row("compare", 7, 5, "greater", null, 7, insert(7)),
      row("insert", 7, 8, null, "right", 8, insert(7)),
      row("compare", 13, 1, "greater", null, 8, insert(13)),
      row("go-right", 13, 3, null, "right", 8, insert(13)),
      row("compare", 13, 3, "greater", null, 8, insert(13)),
      row("go-right", 13, 6, null, "right", 8, insert(13)),
      row("compare", 13, 6, "less", null, 8, insert(13)),
      row("insert", 13, 9, null, "left", 9, insert(13)),
      row("compare", 4, 1, "less", null, 9, search(4)),
      row("go-left", 4, 2, null, "left", 9, search(4)),
      row("compare", 4, 2, "greater", null, 9, search(4)),
      row("go-right", 4, 5, null, "right", 9, search(4)),
      row("compare", 4, 5, "less", null, 9, search(4)),
      row("go-left", 4, 7, null, "left", 9, search(4)),
      row("compare", 4, 7, "equal", null, 9, search(4)),
      row("found", 4, 7, null, null, 9, search(4)),
      row("compare", 6, 1, "less", null, 9, search(6)),
      row("go-left", 6, 2, null, "left", 9, search(6)),
      row("compare", 6, 2, "greater", null, 9, search(6)),
      row("go-right", 6, 5, null, "right", 9, search(6)),
      row("compare", 6, 5, "equal", null, 9, search(6)),
      row("found", 6, 5, null, null, 9, search(6)),
      row("compare", 8, 1, "equal", null, 9, search(8)),
      row("found", 8, 1, null, null, 9, search(8)),
      row("compare", 5, 1, "less", null, 9, search(5)),
      row("go-left", 5, 2, null, "left", 9, search(5)),
      row("compare", 5, 2, "greater", null, 9, search(5)),
      row("go-right", 5, 5, null, "right", 9, search(5)),
      row("compare", 5, 5, "less", null, 9, search(5)),
      row("go-left", 5, 7, null, "left", 9, search(5)),
      row("compare", 5, 7, "greater", null, 9, search(5)),
      row("not-found", 5, 7, null, "right", 9, search(5)),
      row("compare", 15, 1, "greater", null, 9, search(15)),
      row("go-right", 15, 3, null, "right", 9, search(15)),
      row("compare", 15, 3, "greater", null, 9, search(15)),
      row("go-right", 15, 6, null, "right", 9, search(15)),
      row("compare", 15, 6, "greater", null, 9, search(15)),
      row("not-found", 15, 6, null, "right", 9, search(15)),
    ]);

    const placed = steps[35];
    expect(placed?.action).toBe("insert");
    expect(placed?.nodes).toEqual(SHAPE);
    expect(inorder(placed?.nodes ?? [])).toEqual([1, 3, 4, 6, 7, 8, 10, 13, 14]);
    for (const current of steps.slice(35)) {
      expect(current.nodes).toBe(placed?.nodes);
    }
    expect(steps.filter((current) => current.action === "insert").map((current) => current.value)).toEqual(
      values,
    );
    expect(steps.find((current) => current.action === "insert" && current.value === 8)?.message).toBe(
      "Insert 8 as the root.",
    );
    expect(steps.find((current) => current.action === "insert" && current.value === 4)?.message).toBe(
      "Insert 4 as the left child of 6.",
    );
    expect(steps.find((current) => current.action === "insert" && current.value === 13)?.message).toBe(
      "Insert 13 as the left child of 14.",
    );
    expect(
      steps.find((current) => current.action === "go-right" && current.value === 4 && current.nodeId === 5)
        ?.message,
    ).toBe("Go right from 3 to 6.");
    expect(steps.find((current) => current.action === "found" && current.value === 4)?.message).toBe(
      "Search finds 4.",
    );
    expect(steps.find((current) => current.action === "found" && current.value === 6)?.message).toBe(
      "Search finds 6.",
    );
    expect(steps.find((current) => current.action === "found" && current.value === 8)?.message).toBe(
      "Search finds 8.",
    );
    expect(steps.find((current) => current.action === "not-found" && current.value === 5)?.message).toBe(
      "Search for 5. 5 is greater than 4, and 4 has no right child, so 5 is not in the tree.",
    );
    expect(steps.find((current) => current.action === "not-found" && current.value === 15)?.message).toBe(
      "Search for 15. 15 is greater than 14, and 14 has no right child, so 15 is not in the tree.",
    );

    const signed = bstSteps([
      { op: "insert", value: 0 },
      { op: "insert", value: -2 },
      { op: "insert", value: 5 },
    ]);
    expect(signed[signed.length - 1]?.nodes).toEqual([
      { id: 1, value: 0, parent: null, left: 2, right: 3 },
      { id: 2, value: -2, parent: 1, left: null, right: null },
      { id: 3, value: 5, parent: 1, left: null, right: null },
    ]);
    expect(inorder(signed[signed.length - 1]?.nodes ?? [])).toEqual([-2, 0, 5]);
  });

  it("skips a duplicate at the root and deeper, then still accepts a new value", () => {
    const steps = bstSteps([
      { op: "insert", value: 8 },
      { op: "insert", value: 3 },
      { op: "insert", value: 10 },
      { op: "insert", value: 3 },
      { op: "search", value: 3 },
      { op: "insert", value: 8 },
      { op: "insert", value: 1 },
    ]);

    const insert = (value: number): BstOperation => ({ op: "insert", value });
    const search = (value: number): BstOperation => ({ op: "search", value });
    expect(steps.map((current) => current.message)).toEqual([
      "Start with an empty tree.",
      "Insert 8 as the root.",
      "Compare 3 with 8. 3 is less than 8.",
      "Insert 3 as the left child of 8.",
      "Compare 10 with 8. 10 is greater than 8.",
      "Insert 10 as the right child of 8.",
      "Compare 3 with 8. 3 is less than 8.",
      "Go left from 8 to 3.",
      "Compare 3 with 3. The values are equal.",
      "3 is already in the tree. The duplicate is not inserted.",
      "Compare 3 with 8. 3 is less than 8.",
      "Go left from 8 to 3.",
      "Compare 3 with 3. The values are equal.",
      "Search finds 3.",
      "Compare 8 with 8. The values are equal.",
      "8 is already in the tree. The duplicate is not inserted.",
      "Compare 1 with 8. 1 is less than 8.",
      "Go left from 8 to 3.",
      "Compare 1 with 3. 1 is less than 3.",
      "Insert 1 as the left child of 3.",
    ]);
    expect(project(steps)).toEqual([
      row("start", null, null, null, null, 0),
      row("insert", 8, 1, null, null, 1, insert(8)),
      row("compare", 3, 1, "less", null, 1, insert(3)),
      row("insert", 3, 2, null, "left", 2, insert(3)),
      row("compare", 10, 1, "greater", null, 2, insert(10)),
      row("insert", 10, 3, null, "right", 3, insert(10)),
      row("compare", 3, 1, "less", null, 3, insert(3)),
      row("go-left", 3, 2, null, "left", 3, insert(3)),
      row("compare", 3, 2, "equal", null, 3, insert(3)),
      row("duplicate", 3, 2, null, null, 3, insert(3)),
      row("compare", 3, 1, "less", null, 3, search(3)),
      row("go-left", 3, 2, null, "left", 3, search(3)),
      row("compare", 3, 2, "equal", null, 3, search(3)),
      row("found", 3, 2, null, null, 3, search(3)),
      row("compare", 8, 1, "equal", null, 3, insert(8)),
      row("duplicate", 8, 1, null, null, 3, insert(8)),
      row("compare", 1, 1, "less", null, 3, insert(1)),
      row("go-left", 1, 2, null, "left", 3, insert(1)),
      row("compare", 1, 2, "less", null, 3, insert(1)),
      row("insert", 1, 4, null, "left", 4, insert(1)),
    ]);

    const both = [
      { id: 1, value: 8, parent: null, left: 2, right: 3 },
      { id: 2, value: 3, parent: 1, left: null, right: null },
      { id: 3, value: 10, parent: 1, left: null, right: null },
    ];
    expect(steps[5]?.nodes).toEqual(both);
    for (let index = 6; index <= 18; index += 1) {
      expect(steps[index]?.nodes).toBe(steps[5]?.nodes);
    }
    expect(steps[19]?.nodes).toEqual([
      { id: 1, value: 8, parent: null, left: 2, right: 3 },
      { id: 2, value: 3, parent: 1, left: 4, right: null },
      { id: 3, value: 10, parent: 1, left: null, right: null },
      { id: 4, value: 1, parent: 2, left: null, right: null },
    ]);
    expect(steps[19]?.nodes).not.toBe(steps[5]?.nodes);
    expect(steps[6]?.operation).toBe(steps[9]?.operation);
    expect(steps[10]?.operation).toBe(steps[13]?.operation);
    expect(steps[14]?.operation).toBe(steps[15]?.operation);
    expect(steps[6]?.operation).not.toBe(steps[14]?.operation);
    expect(steps.filter((current) => current.action === "insert").map((current) => current.nodeId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("records a miss in an empty tree and when the next child is missing", () => {
    expect(project(bstSteps([]))).toEqual([row("start", null, null, null, null, 0)]);
    expect(bstSteps([])[0]?.message).toBe("Start with an empty tree.");

    const empty = bstSteps([{ op: "search", value: 4 }]);
    expect(project(empty)).toEqual([
      row("start", null, null, null, null, 0),
      row("not-found", 4, null, null, null, 0, { op: "search", value: 4 }),
    ]);
    expect(empty[1]?.message).toBe("Search an empty tree for 4. It is not there.");
    expect(empty[0]?.nodes).toEqual([]);
    expect(empty[0]?.nodes).toBe(empty[1]?.nodes);
    expect(Object.isFrozen(empty[0]?.nodes)).toBe(true);

    const beside = bstSteps([
      { op: "insert", value: 8 },
      { op: "search", value: 9 },
      { op: "search", value: 2 },
    ]);
    expect(beside.map((current) => current.message)).toEqual([
      "Start with an empty tree.",
      "Insert 8 as the root.",
      "Compare 9 with 8. 9 is greater than 8.",
      "Search for 9. 9 is greater than 8, and 8 has no right child, so 9 is not in the tree.",
      "Compare 2 with 8. 2 is less than 8.",
      "Search for 2. 2 is less than 8, and 8 has no left child, so 2 is not in the tree.",
    ]);
    expect(beside[1]?.nodes).toEqual([
      { id: 1, value: 8, parent: null, left: null, right: null },
    ]);
    expect(beside[2]?.nodes).toBe(beside[1]?.nodes);
    expect(beside[3]?.nodes).toBe(beside[1]?.nodes);
    expect(beside[4]?.nodes).toBe(beside[1]?.nodes);
    expect(beside[5]?.nodes).toBe(beside[1]?.nodes);
    expect(beside[3]).toMatchObject({ action: "not-found", nodeId: 1, side: "right" });
    expect(beside[5]).toMatchObject({ action: "not-found", nodeId: 1, side: "left" });
    expect(beside.map((current) => current.action)).not.toContain("go-left");
    expect(beside.map((current) => current.action)).not.toContain("go-right");

    const rooted = bstSteps([{ op: "insert", value: 4 }]);
    expect(rooted.map((current) => current.action)).toEqual(["start", "insert"]);
    expect(rooted[1]?.message).toBe("Insert 4 as the root.");
    expect(rooted[1]?.side).toBeNull();
    expect(rooted[1]?.nodes).toEqual([
      { id: 1, value: 4, parent: null, left: null, right: null },
    ]);
    expect(rooted[0]?.nodes).not.toBe(rooted[1]?.nodes);
  });

  it("agrees with a direct tree on mixed inserts and searches", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      for (let length = 0; length <= 12; length += 1) {
        const operations = script(seed * 100 + length, length);
        const steps = bstSteps(operations);
        const expected = oracle(operations);
        expect(project(steps)).toEqual(
          expected.map((current) => ({
            action: current.action,
            operation: current.operation,
            value: current.value,
            nodeId: current.nodeId,
            relation: current.relation,
            side: current.side,
            size: current.nodes.length,
          })),
        );
        expect(steps.map((current) => current.nodes.map((node) => ({ ...node })))).toEqual(
          expected.map((current) => current.nodes),
        );
        expect(steps[0]?.operation).toBeNull();
        const ordered = inorder(steps[steps.length - 1]?.nodes ?? []);
        expect(ordered).toEqual([...ordered].sort((left, right) => left - right));
        expect(new Set(ordered).size).toBe(ordered.length);
        expect(steps[steps.length - 1]?.nodes.map((node) => node.id)).toEqual(
          ordered.map((_, index) => index + 1),
        );
        for (let index = 0; index < steps.length; index += 1) {
          const current = steps[index];
          expect(current?.message.length).toBeGreaterThan(0);
          expect(Object.isFrozen(current?.nodes)).toBe(true);
          for (const node of current?.nodes ?? []) {
            expect(Object.isFrozen(node)).toBe(true);
          }
          if (index === 0) continue;
          expect(current?.operation).toEqual(operations[expected[index]?.operationIndex ?? -1]);
          expect(Object.isFrozen(current?.operation)).toBe(true);
        }
      }
    }
  });

  it("does not mutate the operations", () => {
    const insert = { op: "insert" as const, value: 3 };
    const operations: BstOperation[] = [
      insert,
      insert,
      { op: "search", value: 3 },
      { op: "search", value: 4 },
    ];
    const before = operations.map((operation) => ({ op: operation.op, value: operation.value }));

    const steps = bstSteps(operations);

    expect(operations).toEqual(before);
    expect(steps[1]?.operation).not.toBe(insert);
    expect(steps[2]?.operation).not.toBe(insert);
    expect(steps[1]?.operation).not.toBe(steps[2]?.operation);
    expect(steps[2]?.operation).toBe(steps[3]?.operation);

    insert.value = 100;
    operations[1] = { op: "search", value: 9 };
    operations.push({ op: "insert", value: 1 });

    expect(steps.map((current) => current.action)).toEqual([
      "start",
      "insert",
      "compare",
      "duplicate",
      "compare",
      "found",
      "compare",
      "not-found",
    ]);
    expect(steps[1]?.nodes).toEqual([
      { id: 1, value: 3, parent: null, left: null, right: null },
    ]);
    expect(steps[1]?.operation).toEqual({ op: "insert", value: 3 });
    expect(steps[3]).toMatchObject({
      action: "duplicate",
      value: 3,
      nodeId: 1,
      message: "3 is already in the tree. The duplicate is not inserted.",
    });
    expect(steps[3]?.nodes).toBe(steps[1]?.nodes);
    expect(steps[5]).toMatchObject({ action: "found", value: 3, nodeId: 1 });
    expect(steps[5]?.nodes).toBe(steps[1]?.nodes);
    expect(steps[7]).toMatchObject({
      action: "not-found",
      value: 4,
      nodeId: 1,
      side: "right",
      message: "Search for 4. 4 is greater than 3, and 3 has no right child, so 4 is not in the tree.",
    });

    expect(Object.isFrozen(steps[1]?.nodes)).toBe(true);
    expect(() => {
      (steps[1]?.nodes as BstNode[])[0] = {
        id: 1,
        value: 7,
        parent: null,
        left: null,
        right: null,
      };
    }).toThrow(TypeError);
    expect(Object.isFrozen(steps[1]?.operation)).toBe(true);
    expect(() => {
      (steps[1]?.operation as { value: number }).value = 7;
    }).toThrow(TypeError);
  });

  it("accepts frozen operations", () => {
    const operations = Object.freeze([
      Object.freeze({ op: "insert" as const, value: 0 }),
      Object.freeze({ op: "insert" as const, value: -1 }),
      Object.freeze({ op: "search" as const, value: -1 }),
    ]);
    const steps = bstSteps(operations);
    expect(steps.map((current) => current.action)).toEqual([
      "start",
      "insert",
      "compare",
      "insert",
      "compare",
      "go-left",
      "compare",
      "found",
    ]);
    expect(steps[steps.length - 1]?.nodes).toEqual([
      { id: 1, value: 0, parent: null, left: 2, right: null },
      { id: 2, value: -1, parent: 1, left: null, right: null },
    ]);
    expect(steps[steps.length - 1]?.nodeId).toBe(2);
    expect(operations[0]).toEqual({ op: "insert", value: 0 });
  });

  it("rejects non-finite values and unknown operations", () => {
    expect(() => bstSteps([{ op: "insert", value: Number.NaN }])).toThrow(/finite/);
    expect(() => bstSteps([{ op: "insert", value: Number.POSITIVE_INFINITY }])).toThrow(/finite/);
    expect(() => bstSteps([{ op: "insert", value: Number.NEGATIVE_INFINITY }])).toThrow(/finite/);
    expect(() => bstSteps([{ op: "search", value: Number.NaN }])).toThrow(/finite/);
    expect(() => bstSteps([{ op: "shift", value: 1 } as unknown as BstOperation])).toThrow(
      /insert or search/,
    );
    expect(() => bstSteps([null as unknown as BstOperation])).toThrow(/insert or search/);
    expect(() => bstSteps([{ op: "insert" } as unknown as BstOperation])).toThrow(/finite/);
    expect(() => bstSteps([{ op: "search" } as unknown as BstOperation])).toThrow(/finite/);
  });
});

interface OracleNode {
  id: number;
  value: number;
  parent: number | null;
  left: number | null;
  right: number | null;
}

interface OracleStep {
  action: string;
  operation: BstOperation | null;
  operationIndex: number | null;
  value: number | null;
  nodeId: number | null;
  relation: "less" | "greater" | "equal" | null;
  side: "left" | "right" | null;
  nodes: OracleNode[];
}

function oracle(operations: readonly BstOperation[]): OracleStep[] {
  const live: OracleNode[] = [];
  const byId = new Map<number, OracleNode>();
  let rootId: number | null = null;
  let nextId = 1;
  const trace: OracleStep[] = [];
  const picture = (): OracleNode[] => live.map((node) => ({ ...node }));

  trace.push({
    action: "start",
    operation: null,
    operationIndex: null,
    value: null,
    nodeId: null,
    relation: null,
    side: null,
    nodes: picture(),
  });

  const add = (value: number, parent: number | null): OracleNode => {
    const node: OracleNode = { id: nextId, value, parent, left: null, right: null };
    nextId += 1;
    live.push(node);
    byId.set(node.id, node);
    return node;
  };

  operations.forEach((operation, operationIndex) => {
    const recorded = { op: operation.op, value: operation.value };
    if (rootId === null) {
      if (operation.op === "search") {
        trace.push({
          action: "not-found",
          operation: recorded,
          operationIndex,
          value: operation.value,
          nodeId: null,
          relation: null,
          side: null,
          nodes: picture(),
        });
        return;
      }
      const node = add(operation.value, null);
      rootId = node.id;
      trace.push({
        action: "insert",
        operation: recorded,
        operationIndex,
        value: operation.value,
        nodeId: node.id,
        relation: null,
        side: null,
        nodes: picture(),
      });
      return;
    }

    let current = byId.get(rootId);
    if (current === undefined) throw new Error("Oracle lost the root.");
    while (true) {
      const relation =
        operation.value < current.value ? "less" : operation.value > current.value ? "greater" : "equal";
      trace.push({
        action: "compare",
        operation: recorded,
        operationIndex,
        value: operation.value,
        nodeId: current.id,
        relation,
        side: null,
        nodes: picture(),
      });
      if (relation === "equal") {
        trace.push({
          action: operation.op === "insert" ? "duplicate" : "found",
          operation: recorded,
          operationIndex,
          value: operation.value,
          nodeId: current.id,
          relation: null,
          side: null,
          nodes: picture(),
        });
        return;
      }
      const side = relation === "less" ? "left" : "right";
      const childId = side === "left" ? current.left : current.right;
      if (childId === null) {
        if (operation.op === "search") {
          trace.push({
            action: "not-found",
            operation: recorded,
            operationIndex,
            value: operation.value,
            nodeId: current.id,
            relation: null,
            side,
            nodes: picture(),
          });
          return;
        }
        const created = add(operation.value, current.id);
        if (side === "left") current.left = created.id;
        else current.right = created.id;
        trace.push({
          action: "insert",
          operation: recorded,
          operationIndex,
          value: operation.value,
          nodeId: created.id,
          relation: null,
          side,
          nodes: picture(),
        });
        return;
      }
      trace.push({
        action: side === "left" ? "go-left" : "go-right",
        operation: recorded,
        operationIndex,
        value: operation.value,
        nodeId: childId,
        relation: null,
        side,
        nodes: picture(),
      });
      const child = byId.get(childId);
      if (child === undefined) throw new Error("Oracle lost a child.");
      current = child;
    }
  });

  return trace;
}

function script(seed: number, length: number): BstOperation[] {
  let state = seed >>> 0;
  const operations: BstOperation[] = [];
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const value = (state % 11) - 5;
    operations.push(state % 5 <= 2 ? { op: "insert", value } : { op: "search", value });
  }
  return operations;
}

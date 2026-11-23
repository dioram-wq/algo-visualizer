import { describe, expect, it } from "vitest";
import { gridBfsSteps } from "./grid-bfs.ts";
import { gridDfsSteps, type GridCell, type GridDfsStep, type GridPoint } from "./grid-dfs.ts";

const DIRECTIONS = [
  { row: -1, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
] as const;

function cells(rows: readonly string[]): GridCell[][] {
  return rows.map((row) =>
    [...row].map((symbol) => {
      if (symbol === ".") return "open";
      if (symbol === "#") return "wall";
      throw new Error(`Unexpected grid symbol ${symbol}.`);
    }),
  );
}

function at(row: number, column: number): GridPoint {
  return { row, column };
}

function outline(steps: readonly GridDfsStep[]) {
  return steps.map((current) => ({
    action: current.action,
    cell: current.cell === null ? null : { row: current.cell.row, column: current.cell.column },
    stack: current.stack.map((point) => ({ row: point.row, column: point.column })),
    visited: current.visited.map((point) => ({ row: point.row, column: point.column })),
    path: current.path.map((point) => ({ row: point.row, column: point.column })),
    message: current.message,
  }));
}

function row(
  action: GridDfsStep["action"],
  cell: GridPoint | null,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
  message: string,
) {
  return {
    action,
    cell: cell === null ? null : { row: cell.row, column: cell.column },
    stack: stack.map((point) => ({ row: point.row, column: point.column })),
    visited: visited.map((point) => ({ row: point.row, column: point.column })),
    path: path.map((point) => ({ row: point.row, column: point.column })),
    message,
  };
}

function key(point: GridPoint): string {
  return `${point.row},${point.column}`;
}

function same(left: GridPoint, right: GridPoint): boolean {
  return left.row === right.row && left.column === right.column;
}

function manhattan(left: GridPoint, right: GridPoint): number {
  return Math.abs(left.row - right.row) + Math.abs(left.column - right.column);
}

/**
 * The stack grows and shrinks at the top. A cell is pushed from the cell
 * popped just before it, the first open neighbor is popped first, and a pop
 * whose parent is not that cell is a backtrack. The goal ends the search.
 */
function expectSearch(
  steps: readonly GridDfsStep[],
  source: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
): void {
  expect(steps.length).toBeGreaterThan(0);
  const opening = steps[0];
  if (opening === undefined) throw new Error("Missing the first step.");
  expect(opening.action).toBe("push");
  expect(opening.cell).toEqual(start);
  expect(opening.stack).toEqual([start]);
  expect(opening.visited).toEqual([]);
  expect(opening.path).toEqual([]);

  const seen = new Set<string>();
  const parents = new Map<string, string | null>();
  let sourceKey: string | null = null;

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];
    if (current === undefined) throw new Error("Missing a step.");
    expect(current.grid).toBe(opening.grid);
    expect(current.start).toBe(opening.start);
    expect(current.goal).toBe(opening.goal);
    expect(current.start).toEqual(start);
    expect(current.goal).toEqual(goal);
    expect(current.grid).toEqual(source);
    expect(current.message.length).toBeGreaterThan(0);
    expect(Object.isFrozen(current.grid)).toBe(true);
    expect(Object.isFrozen(current.start)).toBe(true);
    expect(Object.isFrozen(current.goal)).toBe(true);
    expect(Object.isFrozen(current.stack)).toBe(true);
    expect(Object.isFrozen(current.visited)).toBe(true);
    expect(Object.isFrozen(current.path)).toBe(true);
    if (current.cell !== null) expect(Object.isFrozen(current.cell)).toBe(true);
    for (const line of current.grid) expect(Object.isFrozen(line)).toBe(true);

    const ids = new Set<string>();
    for (const point of [...current.stack, ...current.visited, ...current.path]) {
      expect(current.grid[point.row]?.[point.column]).toBe("open");
    }
    for (const point of current.stack) {
      const id = key(point);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(current.visited.some((item) => same(item, point))).toBe(false);
    }
    for (const point of current.visited) {
      const id = key(point);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }

    if (index === 0) {
      if (current.cell === null) throw new Error("Missing the start cell.");
      seen.add(key(current.cell));
      parents.set(key(current.cell), null);
      continue;
    }

    const previous = steps[index - 1];
    if (previous === undefined) throw new Error("Missing the previous step.");

    if (current.action === "push") {
      if (current.cell === null) throw new Error("Missing a pushed cell.");
      expect(current.stack.at(-1)).toBe(current.cell);
      expect(current.stack.slice(0, -1)).toEqual([...previous.stack]);
      expect(current.visited).toBe(previous.visited);
      expect(current.path).toBe(opening.path);
      expect(seen.has(key(current.cell))).toBe(false);
      seen.add(key(current.cell));
      if (sourceKey === null) throw new Error("A pushed cell has no parent.");
      const from = [...previous.visited].at(-1);
      if (from === undefined || key(from) !== sourceKey) throw new Error("A pushed cell left its parent.");
      expect(manhattan(current.cell, from)).toBe(1);
      parents.set(key(current.cell), sourceKey);
      continue;
    }

    if (current.action === "visit" || current.action === "backtrack" || current.action === "found") {
      expect(previous.stack.at(-1)).toBe(current.cell);
      expect(current.stack).toEqual(previous.stack.slice(0, -1));
      expect(current.visited.at(-1)).toBe(current.cell);
      expect([...current.visited].slice(0, -1)).toEqual([...previous.visited]);
      if (current.cell === null) throw new Error("Missing a popped cell.");
      expect(seen.has(key(current.cell))).toBe(true);
      const parentKey = parents.get(key(current.cell));
      if (parentKey === undefined) throw new Error("A popped cell was never pushed.");
      const previousVisit = previous.visited.at(-1);
      const previousKey = previousVisit === undefined ? null : key(previousVisit);
      const backtrack = parentKey !== null && parentKey !== previousKey;
      sourceKey = key(current.cell);
      if (current.action === "visit") {
        expect(backtrack).toBe(false);
        expect(current.path).toBe(opening.path);
        expect(current.cell).not.toEqual(goal);
        expect(index).not.toBe(steps.length - 1);
        expectNeighborPushes(steps, index, seen);
        continue;
      }
      if (current.action === "backtrack") {
        expect(backtrack).toBe(true);
        expect(current.visited.length).toBeGreaterThanOrEqual(3);
        expect(current.path).toBe(opening.path);
        expect(current.cell).not.toEqual(goal);
        expect(current.cell).not.toEqual(start);
        expect(index).not.toBe(steps.length - 1);
        expect(current.message.startsWith("Backtrack to")).toBe(true);
        expectNeighborPushes(steps, index, seen);
        continue;
      }
      expect(index).toBe(steps.length - 1);
      expect(current.cell).toBe(current.goal);
      expect(current.path[0]).toBe(current.start);
      expect(current.path.at(-1)).toBe(current.goal);
      expectWalk(current);
      expect(current.message.startsWith(backtrack ? "Backtrack to" : "Pop")).toBe(true);
      const length = current.path.length - 1;
      expect(current.message).toContain(length === 1 ? "1 step." : `${length} steps.`);
      expect(length).toBeGreaterThanOrEqual(manhattan(start, goal));
      continue;
    }

    expect(current.action).toBe("no-path");
    expect(index).toBe(steps.length - 1);
    expect(previous.action === "visit" || previous.action === "backtrack").toBe(true);
    expect(previous.stack).toEqual([]);
    expect(current.stack).toBe(previous.stack);
    expect(current.visited).toBe(previous.visited);
    expect(current.path).toBe(opening.path);
    expect(current.cell).toBeNull();
    expect(current.visited.some((item) => same(item, goal))).toBe(false);
    expect(current.message).toContain("no path");
  }

  const last = steps[steps.length - 1];
  expect(last?.action === "found" || last?.action === "no-path").toBe(true);
}

function expectNeighborPushes(steps: readonly GridDfsStep[], index: number, discovered: ReadonlySet<string>): void {
  const current = steps[index];
  if (current === undefined || current.cell === null) throw new Error("Missing an expanded cell.");
  const expected: GridPoint[] = [];
  for (const direction of DIRECTIONS) {
    const row = current.cell.row + direction.row;
    const column = current.cell.column + direction.column;
    const kind = current.grid[row]?.[column];
    if (kind !== "open") continue;
    if (discovered.has(`${row},${column}`)) continue;
    expected.push({ row, column });
  }
  expected.reverse();
  const actual: GridPoint[] = [];
  for (let cursor = index + 1; cursor < steps.length; cursor += 1) {
    const next = steps[cursor];
    if (next === undefined || next.action !== "push") break;
    if (next.cell === null) throw new Error("Missing a pushed cell.");
    actual.push(next.cell);
  }
  expect(actual).toEqual(expected);
}

function expectWalk(found: GridDfsStep): void {
  const path = found.path;
  expect(path.length).toBeGreaterThan(0);
  const seen = new Set<string>();
  let previousIndex = -1;
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (point === undefined) throw new Error("Missing a path cell.");
    expect(seen.has(key(point))).toBe(false);
    seen.add(key(point));
    const visitedIndex = found.visited.findIndex((item) => item === point);
    expect(visitedIndex).toBeGreaterThan(previousIndex);
    previousIndex = visitedIndex;
    expect(found.grid[point.row]?.[point.column]).toBe("open");
    if (index === 0) continue;
    const previous = path[index - 1];
    if (previous === undefined) throw new Error("Missing a path cell.");
    expect(manhattan(previous, point)).toBe(1);
  }
}

describe("gridDfsSteps", () => {
  it("searches an open grid and stops with the path it followed", () => {
    const picture = cells(["..", ".."]);
    const start = at(0, 0);
    const goal = at(1, 1);
    const steps = gridDfsSteps(picture, start, goal);

    expect(outline(steps)).toEqual([
      row(
        "push",
        start,
        [start],
        [],
        [],
        "Push (0, 0). It is the start. The stack is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        start,
        [],
        [start],
        [],
        "Pop (0, 0) and visit it. The stack is now empty, and the visited cells are (0, 0).",
      ),
      row(
        "push",
        at(1, 0),
        [at(1, 0)],
        [start],
        [],
        "Push (1, 0). The stack is now (1, 0), and the visited cells are (0, 0).",
      ),
      row(
        "push",
        at(0, 1),
        [at(1, 0), at(0, 1)],
        [start],
        [],
        "Push (0, 1). The stack is now (1, 0), (0, 1), bottom to top, and the visited cells are (0, 0).",
      ),
      row(
        "visit",
        at(0, 1),
        [at(1, 0)],
        [start, at(0, 1)],
        [],
        "Pop (0, 1) and visit it. The stack is now (1, 0), and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "push",
        goal,
        [at(1, 0), goal],
        [start, at(0, 1)],
        [],
        "Push (1, 1). The stack is now (1, 0), (1, 1), bottom to top, and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "found",
        goal,
        [at(1, 0)],
        [start, at(0, 1), goal],
        [start, at(0, 1), goal],
        "Pop (1, 1). It is the goal. The path is (0, 0), (0, 1), (1, 1), which is 2 steps.",
      ),
    ]);

    const found = steps[6];
    expect(found?.path).toHaveLength(3);
    expect(found?.stack).toEqual([at(1, 0)]);
    expect(found?.visited.some((point) => same(point, at(1, 0)))).toBe(false);
    expect(steps[2]?.visited).toBe(steps[1]?.visited);
    expect(steps[3]?.visited).toBe(steps[1]?.visited);
    expect(steps[5]?.visited).toBe(steps[4]?.visited);
    expect(found?.cell).toBe(found?.goal);
    expect(found?.path[0]).toBe(found?.start);
    expect(found?.path.at(-1)).toBe(found?.goal);
    expect(steps[5]?.stack.at(-1)).toBe(steps[5]?.cell);
    expect(steps[4]?.stack.at(-1)).toBe(steps[5]?.stack[0]);
    expectSearch(steps, picture, start, goal);
  });

  it("follows a longer path than breadth-first search when the first branch runs past the goal", () => {
    const picture = cells(["...", "...", "..."]);
    const start = at(0, 0);
    const goal = at(2, 0);
    const steps = gridDfsSteps(picture, start, goal);
    const breadth = gridBfsSteps(picture, start, goal);
    const found = steps.at(-1);

    expect(steps.map((current) => current.action)).toEqual([
      "push",
      "visit",
      "push",
      "push",
      "visit",
      "push",
      "push",
      "visit",
      "push",
      "visit",
      "push",
      "visit",
      "push",
      "visit",
      "push",
      "found",
    ]);
    expect(found?.action).toBe("found");
    expect(found?.path).toEqual([start, at(0, 1), at(0, 2), at(1, 2), at(2, 2), at(2, 1), goal]);
    expect(found?.visited).toEqual([start, at(0, 1), at(0, 2), at(1, 2), at(2, 2), at(2, 1), goal]);
    expect(found?.stack).toEqual([at(1, 0), at(1, 1)]);
    expect(found?.message).toBe(
      "Pop (2, 0). It is the goal. The path is (0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 1), (2, 0), which is 6 steps.",
    );
    expect(found?.path).toHaveLength(7);
    expect(breadth.at(-1)?.path).toEqual([start, at(1, 0), goal]);
    expect((found?.path.length ?? 0) > (breadth.at(-1)?.path.length ?? 0)).toBe(true);
    expect(steps.some((current) => current.action === "backtrack")).toBe(false);
    expectSearch(steps, picture, start, goal);
  });

  it("walks around a wall, backtracks out of a dead end, and then reaches the goal", () => {
    const picture = cells([".#.", "...", "..."]);
    const start = at(1, 0);
    const goal = at(2, 2);
    const steps = gridDfsSteps(picture, start, goal);
    const wall = at(0, 1);

    expect(outline(steps)).toEqual([
      row(
        "push",
        start,
        [start],
        [],
        [],
        "Push (1, 0). It is the start. The stack is (1, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        start,
        [],
        [start],
        [],
        "Pop (1, 0) and visit it. The stack is now empty, and the visited cells are (1, 0).",
      ),
      row(
        "push",
        at(2, 0),
        [at(2, 0)],
        [start],
        [],
        "Push (2, 0). The stack is now (2, 0), and the visited cells are (1, 0).",
      ),
      row(
        "push",
        at(1, 1),
        [at(2, 0), at(1, 1)],
        [start],
        [],
        "Push (1, 1). The stack is now (2, 0), (1, 1), bottom to top, and the visited cells are (1, 0).",
      ),
      row(
        "push",
        at(0, 0),
        [at(2, 0), at(1, 1), at(0, 0)],
        [start],
        [],
        "Push (0, 0). The stack is now (2, 0), (1, 1), (0, 0), bottom to top, and the visited cells are (1, 0).",
      ),
      row(
        "visit",
        at(0, 0),
        [at(2, 0), at(1, 1)],
        [start, at(0, 0)],
        [],
        "Pop (0, 0) and visit it. The stack is now (2, 0), (1, 1), bottom to top, and the visited cells are (1, 0), (0, 0).",
      ),
      row(
        "backtrack",
        at(1, 1),
        [at(2, 0)],
        [start, at(0, 0), at(1, 1)],
        [],
        "Backtrack to (1, 1) and visit it. The stack is now (2, 0), and the visited cells are (1, 0), (0, 0), (1, 1).",
      ),
      row(
        "push",
        at(2, 1),
        [at(2, 0), at(2, 1)],
        [start, at(0, 0), at(1, 1)],
        [],
        "Push (2, 1). The stack is now (2, 0), (2, 1), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1).",
      ),
      row(
        "push",
        at(1, 2),
        [at(2, 0), at(2, 1), at(1, 2)],
        [start, at(0, 0), at(1, 1)],
        [],
        "Push (1, 2). The stack is now (2, 0), (2, 1), (1, 2), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1).",
      ),
      row(
        "visit",
        at(1, 2),
        [at(2, 0), at(2, 1)],
        [start, at(0, 0), at(1, 1), at(1, 2)],
        [],
        "Pop (1, 2) and visit it. The stack is now (2, 0), (2, 1), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1), (1, 2).",
      ),
      row(
        "push",
        goal,
        [at(2, 0), at(2, 1), goal],
        [start, at(0, 0), at(1, 1), at(1, 2)],
        [],
        "Push (2, 2). The stack is now (2, 0), (2, 1), (2, 2), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1), (1, 2).",
      ),
      row(
        "push",
        at(0, 2),
        [at(2, 0), at(2, 1), goal, at(0, 2)],
        [start, at(0, 0), at(1, 1), at(1, 2)],
        [],
        "Push (0, 2). The stack is now (2, 0), (2, 1), (2, 2), (0, 2), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1), (1, 2).",
      ),
      row(
        "visit",
        at(0, 2),
        [at(2, 0), at(2, 1), goal],
        [start, at(0, 0), at(1, 1), at(1, 2), at(0, 2)],
        [],
        "Pop (0, 2) and visit it. The stack is now (2, 0), (2, 1), (2, 2), bottom to top, and the visited cells are (1, 0), (0, 0), (1, 1), (1, 2), (0, 2).",
      ),
      row(
        "found",
        goal,
        [at(2, 0), at(2, 1)],
        [start, at(0, 0), at(1, 1), at(1, 2), at(0, 2), goal],
        [start, at(1, 1), at(1, 2), goal],
        "Backtrack to (2, 2). It is the goal. The path is (1, 0), (1, 1), (1, 2), (2, 2), which is 3 steps.",
      ),
    ]);

    for (const current of steps) {
      expect(current.stack.some((point) => same(point, wall))).toBe(false);
      expect(current.visited.some((point) => same(point, wall))).toBe(false);
      expect(current.path.some((point) => same(point, wall))).toBe(false);
      expect(current.cell === null || !same(current.cell, wall)).toBe(true);
    }
    expect(steps[6]?.action).toBe("backtrack");
    expect(steps[6]?.visited.at(-2)).toEqual(at(0, 0));
    expect(steps.at(-1)?.stack.some((point) => same(point, at(2, 0)))).toBe(true);
    expect(steps.at(-1)?.path.some((point) => same(point, at(0, 0)))).toBe(false);
    expectSearch(steps, picture, start, goal);
  });

  it("reports no path when walls block the goal, including after a backtrack", () => {
    const diagonal = cells([".#", "#."]);
    const separated = cells(["..#", "..#", "##."]);
    const corner = gridDfsSteps(diagonal, at(0, 0), at(1, 1));
    const region = gridDfsSteps(separated, at(1, 0), at(2, 2));

    expect(outline(corner)).toEqual([
      row(
        "push",
        at(0, 0),
        [at(0, 0)],
        [],
        [],
        "Push (0, 0). It is the start. The stack is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        at(0, 0),
        [],
        [at(0, 0)],
        [],
        "Pop (0, 0) and visit it. The stack is now empty, and the visited cells are (0, 0).",
      ),
      row(
        "no-path",
        null,
        [],
        [at(0, 0)],
        [],
        "The stack is empty, and (1, 1) was not reached. There is no path. The visited cells are (0, 0).",
      ),
    ]);
    expect(corner[2]?.stack).toBe(corner[1]?.stack);
    expect(corner[2]?.visited).toBe(corner[1]?.visited);
    expect(corner[2]?.path).toBe(corner[0]?.path);
    expect(corner.map((current) => current.action)).toEqual(["push", "visit", "no-path"]);

    expect(outline(region)).toEqual([
      row(
        "push",
        at(1, 0),
        [at(1, 0)],
        [],
        [],
        "Push (1, 0). It is the start. The stack is (1, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        at(1, 0),
        [],
        [at(1, 0)],
        [],
        "Pop (1, 0) and visit it. The stack is now empty, and the visited cells are (1, 0).",
      ),
      row(
        "push",
        at(1, 1),
        [at(1, 1)],
        [at(1, 0)],
        [],
        "Push (1, 1). The stack is now (1, 1), and the visited cells are (1, 0).",
      ),
      row(
        "push",
        at(0, 0),
        [at(1, 1), at(0, 0)],
        [at(1, 0)],
        [],
        "Push (0, 0). The stack is now (1, 1), (0, 0), bottom to top, and the visited cells are (1, 0).",
      ),
      row(
        "visit",
        at(0, 0),
        [at(1, 1)],
        [at(1, 0), at(0, 0)],
        [],
        "Pop (0, 0) and visit it. The stack is now (1, 1), and the visited cells are (1, 0), (0, 0).",
      ),
      row(
        "push",
        at(0, 1),
        [at(1, 1), at(0, 1)],
        [at(1, 0), at(0, 0)],
        [],
        "Push (0, 1). The stack is now (1, 1), (0, 1), bottom to top, and the visited cells are (1, 0), (0, 0).",
      ),
      row(
        "visit",
        at(0, 1),
        [at(1, 1)],
        [at(1, 0), at(0, 0), at(0, 1)],
        [],
        "Pop (0, 1) and visit it. The stack is now (1, 1), and the visited cells are (1, 0), (0, 0), (0, 1).",
      ),
      row(
        "backtrack",
        at(1, 1),
        [],
        [at(1, 0), at(0, 0), at(0, 1), at(1, 1)],
        [],
        "Backtrack to (1, 1) and visit it. The stack is now empty, and the visited cells are (1, 0), (0, 0), (0, 1), (1, 1).",
      ),
      row(
        "no-path",
        null,
        [],
        [at(1, 0), at(0, 0), at(0, 1), at(1, 1)],
        [],
        "The stack is empty, and (2, 2) was not reached. There is no path. The visited cells are (1, 0), (0, 0), (0, 1), (1, 1).",
      ),
    ]);
    expect(region.at(-1)?.path).toEqual([]);
    expect(region.at(-1)?.stack).toBe(region.at(-2)?.stack);
    expect(region.at(-1)?.visited).toBe(region.at(-2)?.visited);
    expect(region.at(-2)?.action).toBe("backtrack");
    expectSearch(corner, diagonal, at(0, 0), at(1, 1));
    expectSearch(region, separated, at(1, 0), at(2, 2));
  });

  it("stops on the start when the start is the goal", () => {
    const picture = cells(["...", "...", "..."]);
    const corner = gridDfsSteps(picture, at(0, 0), at(0, 0));
    const middle = gridDfsSteps(picture, at(1, 1), at(1, 1));
    const alone = gridDfsSteps(cells(["."]), at(0, 0), at(0, 0));

    expect(outline(corner)).toEqual([
      row(
        "push",
        at(0, 0),
        [at(0, 0)],
        [],
        [],
        "Push (0, 0). It is the start. The stack is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "found",
        at(0, 0),
        [],
        [at(0, 0)],
        [at(0, 0)],
        "Pop (0, 0). It is the goal. The path is (0, 0), which is 0 steps.",
      ),
    ]);
    expect(corner).toHaveLength(2);
    expect(corner[1]?.path).toHaveLength(1);
    expect(corner[1]?.start).toBe(corner[1]?.goal);
    expect(corner[1]?.cell).toBe(corner[1]?.start);
    expect(corner[1]?.path[0]).toBe(corner[1]?.start);
    expect(corner.map((current) => current.action)).not.toContain("visit");
    expect(corner.map((current) => current.action)).not.toContain("backtrack");
    expect(corner.map((current) => current.action)).not.toContain("no-path");

    expect(middle.map((current) => current.action)).toEqual(["push", "found"]);
    expect(middle[0]?.cell).toEqual(at(1, 1));
    expect(middle[1]?.path).toEqual([at(1, 1)]);
    expect(middle[1]?.visited).toEqual([at(1, 1)]);
    expect(middle[1]?.stack).toEqual([]);
    expect(middle[1]?.message).toBe("Pop (1, 1). It is the goal. The path is (1, 1), which is 0 steps.");

    expect(alone.map((current) => current.action)).toEqual(["push", "found"]);
    expect(alone[1]?.path).toEqual([at(0, 0)]);
    expect(alone[1]?.grid).toEqual([["open"]]);
    expectSearch(corner, picture, at(0, 0), at(0, 0));
    expectSearch(middle, picture, at(1, 1), at(1, 1));
    expectSearch(alone, cells(["."]), at(0, 0), at(0, 0));
  });

  it("pops the first open neighbor first, including one step in each direction", () => {
    const plus = cells(["...", "...", "..."]);
    const center = at(1, 1);
    const steps = gridDfsSteps(plus, center, at(1, 0));
    expect(outline(steps.slice(0, 6))).toEqual([
      row(
        "push",
        center,
        [center],
        [],
        [],
        "Push (1, 1). It is the start. The stack is (1, 1), and no cell has been visited yet.",
      ),
      row(
        "visit",
        center,
        [],
        [center],
        [],
        "Pop (1, 1) and visit it. The stack is now empty, and the visited cells are (1, 1).",
      ),
      row(
        "push",
        at(1, 0),
        [at(1, 0)],
        [center],
        [],
        "Push (1, 0). The stack is now (1, 0), and the visited cells are (1, 1).",
      ),
      row(
        "push",
        at(2, 1),
        [at(1, 0), at(2, 1)],
        [center],
        [],
        "Push (2, 1). The stack is now (1, 0), (2, 1), bottom to top, and the visited cells are (1, 1).",
      ),
      row(
        "push",
        at(1, 2),
        [at(1, 0), at(2, 1), at(1, 2)],
        [center],
        [],
        "Push (1, 2). The stack is now (1, 0), (2, 1), (1, 2), bottom to top, and the visited cells are (1, 1).",
      ),
      row(
        "push",
        at(0, 1),
        [at(1, 0), at(2, 1), at(1, 2), at(0, 1)],
        [center],
        [],
        "Push (0, 1). The stack is now (1, 0), (2, 1), (1, 2), (0, 1), bottom to top, and the visited cells are (1, 1).",
      ),
    ]);
    expect(steps[6]?.action).toBe("visit");
    expect(steps[6]?.cell).toEqual(at(0, 1));
    expect(steps.at(-1)?.action).toBe("found");
    expect(steps.at(-1)?.cell).toEqual(at(1, 0));
    expect(steps.some((current) => current.action === "backtrack")).toBe(true);
    expectSearch(steps, plus, center, at(1, 0));

    const up = gridDfsSteps(cells([".", "."]), at(1, 0), at(0, 0));
    const down = gridDfsSteps(cells([".", "."]), at(0, 0), at(1, 0));
    const left = gridDfsSteps(cells([".."]), at(0, 1), at(0, 0));
    const right = gridDfsSteps(cells([".."]), at(0, 0), at(0, 1));
    expect(up.at(-1)?.path).toEqual([at(1, 0), at(0, 0)]);
    expect(down.at(-1)?.path).toEqual([at(0, 0), at(1, 0)]);
    expect(left.at(-1)?.path).toEqual([at(0, 1), at(0, 0)]);
    expect(right.at(-1)?.path).toEqual([at(0, 0), at(0, 1)]);
    expect(right.at(-1)?.message).toBe(
      "Pop (0, 1). It is the goal. The path is (0, 0), (0, 1), which is 1 step.",
    );
    expect(up.map((current) => current.action)).toEqual(["push", "visit", "push", "found"]);
    expectSearch(up, cells([".", "."]), at(1, 0), at(0, 0));
    expectSearch(down, cells([".", "."]), at(0, 0), at(1, 0));
    expectSearch(left, cells([".."]), at(0, 1), at(0, 0));
    expectSearch(right, cells([".."]), at(0, 0), at(0, 1));
  });

  it("reaches a goal exactly when breadth-first search does", () => {
    const open = cells(["...", "...", "..."]);
    const maze = cells([".##", "#..", "..#"]);
    for (const picture of [open, maze]) {
      for (let startRow = 0; startRow < picture.length; startRow += 1) {
        for (let startColumn = 0; startColumn < 3; startColumn += 1) {
          if (picture[startRow]?.[startColumn] !== "open") continue;
          for (let goalRow = 0; goalRow < picture.length; goalRow += 1) {
            for (let goalColumn = 0; goalColumn < 3; goalColumn += 1) {
              if (picture[goalRow]?.[goalColumn] !== "open") continue;
              const start = at(startRow, startColumn);
              const goal = at(goalRow, goalColumn);
              const depth = gridDfsSteps(picture, start, goal);
              const breadth = gridBfsSteps(picture, start, goal);
              const depthEnd = depth.at(-1);
              const breadthEnd = breadth.at(-1);
              expect(depthEnd?.action === "found").toBe(breadthEnd?.action === "found");
              if (depthEnd?.action === "found" && breadthEnd?.action === "found") {
                expect(depthEnd.path.length).toBeGreaterThanOrEqual(breadthEnd.path.length);
              }
              expectSearch(depth, picture, start, goal);
            }
          }
        }
      }
    }
  });

  it("does not mutate the grid or the cells, and freezes every snapshot", () => {
    const picture = cells(["..", ".."]);
    const top = picture[0];
    if (top === undefined) throw new Error("Missing a row.");
    const start = { row: 0, column: 0 };
    const goal = { row: 1, column: 1 };
    const steps = gridDfsSteps(picture, start, goal);

    top[0] = "wall";
    top.push("open");
    picture.push(["wall"]);
    start.row = 5;
    goal.column = 8;

    expect(steps[0]?.grid).toEqual([
      ["open", "open"],
      ["open", "open"],
    ]);
    expect(steps[0]?.grid).not.toBe(picture);
    expect(steps[0]?.grid[0]).not.toBe(top);
    expect(steps[0]?.start).toEqual({ row: 0, column: 0 });
    expect(steps[0]?.goal).toEqual({ row: 1, column: 1 });
    expect(steps[0]?.start).not.toBe(start);
    expect(steps[0]?.goal).not.toBe(goal);
    expect(steps.at(-1)?.path).toEqual([at(0, 0), at(0, 1), at(1, 1)]);

    expect(Object.isFrozen(steps[0]?.grid)).toBe(true);
    expect(Object.isFrozen(steps[0]?.grid[0])).toBe(true);
    expect(Object.isFrozen(steps[0]?.stack)).toBe(true);
    expect(Object.isFrozen(steps[0]?.visited)).toBe(true);
    expect(Object.isFrozen(steps[0]?.path)).toBe(true);
    expect(Object.isFrozen(steps.at(-1)?.path)).toBe(true);
    expect(() => {
      (steps[0]?.stack as GridPoint[]).push(at(0, 0));
    }).toThrow(TypeError);
    expect(() => {
      (steps[0]?.grid[0] as GridCell[])[0] = "wall";
    }).toThrow(TypeError);
    expect(() => {
      (steps.at(-1)?.path as GridPoint[]).pop();
    }).toThrow(TypeError);

    const frozen = Object.freeze([
      Object.freeze(["open", "open"] as const),
      Object.freeze(["wall", "open"] as const),
    ]);
    const frozenSteps = gridDfsSteps(
      frozen,
      Object.freeze({ row: 0, column: 0 }),
      Object.freeze({ row: 1, column: 1 }),
    );
    expect(frozenSteps.at(-1)?.path).toEqual([at(0, 0), at(0, 1), at(1, 1)]);
    expect(frozen).toEqual([
      ["open", "open"],
      ["wall", "open"],
    ]);
    expectSearch(frozenSteps, frozen, at(0, 0), at(1, 1));
  });

  it("rejects a broken grid, a wall, and a cell that is not on the grid", () => {
    const open = cells(["..", ".."]);
    expect(() => gridDfsSteps([], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridDfsSteps([[]], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridDfsSteps([["open"], ["open", "open"]], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridDfsSteps(null as unknown as readonly (readonly GridCell[])[], at(0, 0), at(0, 0))).toThrow(
      /rectangular/,
    );
    expect(() =>
      gridDfsSteps([["open", "blocked"]] as unknown as readonly (readonly GridCell[])[], at(0, 0), at(0, 0)),
    ).toThrow(/open or wall/);
    expect(() => gridDfsSteps(open, at(-1, 0), at(0, 0))).toThrow(/start cell to be on the grid/);
    expect(() => gridDfsSteps(open, at(0, 0), at(2, 0))).toThrow(/goal cell to be on the grid/);
    expect(() => gridDfsSteps(open, at(0, 1.5), at(0, 0))).toThrow(/integer/);
    expect(() => gridDfsSteps(open, at(Number.NaN, 0), at(0, 0))).toThrow(/integer/);
    expect(() => gridDfsSteps(open, null as unknown as GridPoint, at(0, 0))).toThrow(/point on the grid/);
    expect(() => gridDfsSteps(open, at(0, 0), null as unknown as GridPoint)).toThrow(/point on the grid/);
    expect(() => gridDfsSteps(cells(["#.", ".."]), at(0, 0), at(1, 1))).toThrow(/start cell to be open/);
    expect(() => gridDfsSteps(cells(["..", "#."]), at(0, 0), at(1, 0))).toThrow(/goal cell to be open/);
    expect(() => gridDfsSteps(cells(["."]), at(0, 0), at(0, 0))).not.toThrow();
  });
});

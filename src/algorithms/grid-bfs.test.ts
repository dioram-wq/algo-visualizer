import { describe, expect, it } from "vitest";
import { gridBfsSteps, type GridBfsStep, type GridCell, type GridPoint } from "./grid-bfs.ts";

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

function outline(steps: readonly GridBfsStep[]) {
  return steps.map((current) => ({
    action: current.action,
    cell: current.cell === null ? null : { row: current.cell.row, column: current.cell.column },
    queue: current.queue.map((point) => ({ row: point.row, column: point.column })),
    visited: current.visited.map((point) => ({ row: point.row, column: point.column })),
    path: current.path.map((point) => ({ row: point.row, column: point.column })),
    message: current.message,
  }));
}

function row(
  action: GridBfsStep["action"],
  cell: GridPoint | null,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
  message: string,
) {
  return {
    action,
    cell: cell === null ? null : { row: cell.row, column: cell.column },
    queue: queue.map((point) => ({ row: point.row, column: point.column })),
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
 * The frontier grows at the back and shrinks from the front. A cell is
 * enqueued from the cell dequeued just before it, and the goal ends the search.
 */
function expectSearch(
  steps: readonly GridBfsStep[],
  source: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
): void {
  expect(steps.length).toBeGreaterThan(0);
  const opening = steps[0];
  if (opening === undefined) throw new Error("Missing the first step.");
  expect(opening.action).toBe("enqueue");
  expect(opening.cell).toEqual(start);
  expect(opening.queue).toEqual([start]);
  expect(opening.visited).toEqual([]);
  expect(opening.path).toEqual([]);

  const seen = new Set<string>();
  let parent: GridPoint | null = null;

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
    expect(Object.isFrozen(current.queue)).toBe(true);
    expect(Object.isFrozen(current.visited)).toBe(true);
    expect(Object.isFrozen(current.path)).toBe(true);
    if (current.cell !== null) expect(Object.isFrozen(current.cell)).toBe(true);
    for (const line of current.grid) expect(Object.isFrozen(line)).toBe(true);

    const ids = new Set<string>();
    for (const point of [...current.queue, ...current.visited, ...current.path]) {
      expect(current.grid[point.row]?.[point.column]).toBe("open");
    }
    for (const point of current.queue) {
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
      continue;
    }

    const previous = steps[index - 1];
    if (previous === undefined) throw new Error("Missing the previous step.");

    if (current.action === "enqueue") {
      if (current.cell === null) throw new Error("Missing an enqueued cell.");
      expect(current.queue.at(-1)).toBe(current.cell);
      expect(current.queue.slice(0, -1)).toEqual([...previous.queue]);
      expect(current.visited).toBe(previous.visited);
      expect(current.path).toBe(opening.path);
      expect(seen.has(key(current.cell))).toBe(false);
      seen.add(key(current.cell));
      if (parent === null) throw new Error("An enqueued cell has no parent.");
      expect(manhattan(current.cell, parent)).toBe(1);
      continue;
    }

    if (current.action === "visit" || current.action === "found") {
      expect(previous.queue[0]).toBe(current.cell);
      expect(current.queue).toEqual(previous.queue.slice(1));
      expect(current.visited.at(-1)).toBe(current.cell);
      expect([...current.visited].slice(0, -1)).toEqual([...previous.visited]);
      if (current.cell === null) throw new Error("Missing a dequeued cell.");
      expect(seen.has(key(current.cell))).toBe(true);
      parent = current.cell;
      if (current.action === "visit") {
        expect(current.path).toBe(opening.path);
        expect(current.cell).not.toEqual(goal);
        expect(index).not.toBe(steps.length - 1);
        continue;
      }
      expect(index).toBe(steps.length - 1);
      expect(current.cell).toBe(current.goal);
      expect(current.path[0]).toBe(current.start);
      expect(current.path.at(-1)).toBe(current.goal);
      expectWalk(current);
      const length = current.path.length - 1;
      expect(current.message).toContain(length === 1 ? "1 step." : `${length} steps.`);
      continue;
    }

    expect(current.action).toBe("no-path");
    expect(index).toBe(steps.length - 1);
    expect(previous.action).toBe("visit");
    expect(previous.queue).toEqual([]);
    expect(current.queue).toBe(previous.queue);
    expect(current.visited).toBe(previous.visited);
    expect(current.path).toBe(opening.path);
    expect(current.cell).toBeNull();
    expect(current.visited.some((item) => same(item, goal))).toBe(false);
    expect(current.message).toContain("no path");
  }

  const last = steps[steps.length - 1];
  expect(last?.action === "found" || last?.action === "no-path").toBe(true);
}

function expectWalk(found: GridBfsStep): void {
  const path = found.path;
  expect(path.length).toBeGreaterThan(0);
  const seen = new Set<string>();
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (point === undefined) throw new Error("Missing a path cell.");
    expect(seen.has(key(point))).toBe(false);
    seen.add(key(point));
    expect(found.visited.some((item) => item === point)).toBe(true);
    expect(found.grid[point.row]?.[point.column]).toBe("open");
    if (index === 0) continue;
    const previous = path[index - 1];
    if (previous === undefined) throw new Error("Missing a path cell.");
    expect(manhattan(previous, point)).toBe(1);
  }
}

describe("gridBfsSteps", () => {
  it("searches an open grid and stops with a shortest path", () => {
    const picture = cells(["...", "..."]);
    const start = at(0, 0);
    const goal = at(0, 2);
    const steps = gridBfsSteps(picture, start, goal);

    expect(outline(steps)).toEqual([
      row(
        "enqueue",
        start,
        [start],
        [],
        [],
        "Enqueue (0, 0). It is the start. The queue is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        start,
        [],
        [start],
        [],
        "Dequeue (0, 0) and visit it. The queue is now empty, and the visited cells are (0, 0).",
      ),
      row(
        "enqueue",
        at(0, 1),
        [at(0, 1)],
        [start],
        [],
        "Enqueue (0, 1). The queue is now (0, 1), and the visited cells are (0, 0).",
      ),
      row(
        "enqueue",
        at(1, 0),
        [at(0, 1), at(1, 0)],
        [start],
        [],
        "Enqueue (1, 0). The queue is now (0, 1), (1, 0), front to back, and the visited cells are (0, 0).",
      ),
      row(
        "visit",
        at(0, 1),
        [at(1, 0)],
        [start, at(0, 1)],
        [],
        "Dequeue (0, 1) and visit it. The queue is now (1, 0), and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "enqueue",
        goal,
        [at(1, 0), goal],
        [start, at(0, 1)],
        [],
        "Enqueue (0, 2). The queue is now (1, 0), (0, 2), front to back, and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "enqueue",
        at(1, 1),
        [at(1, 0), goal, at(1, 1)],
        [start, at(0, 1)],
        [],
        "Enqueue (1, 1). The queue is now (1, 0), (0, 2), (1, 1), front to back, and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "visit",
        at(1, 0),
        [goal, at(1, 1)],
        [start, at(0, 1), at(1, 0)],
        [],
        "Dequeue (1, 0) and visit it. The queue is now (0, 2), (1, 1), front to back, and the visited cells are (0, 0), (0, 1), (1, 0).",
      ),
      row(
        "found",
        goal,
        [at(1, 1)],
        [start, at(0, 1), at(1, 0), goal],
        [start, at(0, 1), goal],
        "Dequeue (0, 2). It is the goal. The shortest path is (0, 0), (0, 1), (0, 2), which is 2 steps.",
      ),
    ]);

    const found = steps[8];
    expect(found?.path).toHaveLength(3);
    expect(manhattan(start, goal)).toBe(2);
    expect(found?.queue).toEqual([at(1, 1)]);
    expect(found?.visited.some((point) => same(point, at(1, 1)))).toBe(false);
    expect(found?.visited.some((point) => same(point, at(1, 2)))).toBe(false);
    expect(found?.queue.some((point) => same(point, at(1, 2)))).toBe(false);
    expect(steps[2]?.visited).toBe(steps[1]?.visited);
    expect(steps[3]?.visited).toBe(steps[1]?.visited);
    expect(steps[5]?.visited).toBe(steps[4]?.visited);
    expect(steps[6]?.visited).toBe(steps[4]?.visited);
    expect(found?.cell).toBe(found?.goal);
    expect(found?.path[0]).toBe(found?.start);
    expect(found?.path.at(-1)).toBe(found?.goal);
    expect(steps[6]?.cell).toBe(found?.queue[0]);
    expectSearch(steps, picture, start, goal);
  });

  it("walks around walls on a path longer than the Manhattan distance", () => {
    const picture = cells(["##.", ".#.", "..."]);
    const start = at(1, 0);
    const goal = at(0, 2);
    const steps = gridBfsSteps(picture, start, goal);
    const walls = [at(0, 0), at(0, 1), at(1, 1)];

    expect(outline(steps)).toEqual([
      row(
        "enqueue",
        start,
        [start],
        [],
        [],
        "Enqueue (1, 0). It is the start. The queue is (1, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        start,
        [],
        [start],
        [],
        "Dequeue (1, 0) and visit it. The queue is now empty, and the visited cells are (1, 0).",
      ),
      row(
        "enqueue",
        at(2, 0),
        [at(2, 0)],
        [start],
        [],
        "Enqueue (2, 0). The queue is now (2, 0), and the visited cells are (1, 0).",
      ),
      row(
        "visit",
        at(2, 0),
        [],
        [start, at(2, 0)],
        [],
        "Dequeue (2, 0) and visit it. The queue is now empty, and the visited cells are (1, 0), (2, 0).",
      ),
      row(
        "enqueue",
        at(2, 1),
        [at(2, 1)],
        [start, at(2, 0)],
        [],
        "Enqueue (2, 1). The queue is now (2, 1), and the visited cells are (1, 0), (2, 0).",
      ),
      row(
        "visit",
        at(2, 1),
        [],
        [start, at(2, 0), at(2, 1)],
        [],
        "Dequeue (2, 1) and visit it. The queue is now empty, and the visited cells are (1, 0), (2, 0), (2, 1).",
      ),
      row(
        "enqueue",
        at(2, 2),
        [at(2, 2)],
        [start, at(2, 0), at(2, 1)],
        [],
        "Enqueue (2, 2). The queue is now (2, 2), and the visited cells are (1, 0), (2, 0), (2, 1).",
      ),
      row(
        "visit",
        at(2, 2),
        [],
        [start, at(2, 0), at(2, 1), at(2, 2)],
        [],
        "Dequeue (2, 2) and visit it. The queue is now empty, and the visited cells are (1, 0), (2, 0), (2, 1), (2, 2).",
      ),
      row(
        "enqueue",
        at(1, 2),
        [at(1, 2)],
        [start, at(2, 0), at(2, 1), at(2, 2)],
        [],
        "Enqueue (1, 2). The queue is now (1, 2), and the visited cells are (1, 0), (2, 0), (2, 1), (2, 2).",
      ),
      row(
        "visit",
        at(1, 2),
        [],
        [start, at(2, 0), at(2, 1), at(2, 2), at(1, 2)],
        [],
        "Dequeue (1, 2) and visit it. The queue is now empty, and the visited cells are (1, 0), (2, 0), (2, 1), (2, 2), (1, 2).",
      ),
      row(
        "enqueue",
        goal,
        [goal],
        [start, at(2, 0), at(2, 1), at(2, 2), at(1, 2)],
        [],
        "Enqueue (0, 2). The queue is now (0, 2), and the visited cells are (1, 0), (2, 0), (2, 1), (2, 2), (1, 2).",
      ),
      row(
        "found",
        goal,
        [],
        [start, at(2, 0), at(2, 1), at(2, 2), at(1, 2), goal],
        [start, at(2, 0), at(2, 1), at(2, 2), at(1, 2), goal],
        "Dequeue (0, 2). It is the goal. The shortest path is (1, 0), (2, 0), (2, 1), (2, 2), (1, 2), (0, 2), which is 5 steps.",
      ),
    ]);

    const found = steps.at(-1);
    expect(found?.action).toBe("found");
    expect(found?.path).toHaveLength(6);
    expect(manhattan(start, goal)).toBe(3);
    expect((found?.path.length ?? 0) - 1).toBe(5);
    for (const current of steps) {
      for (const wall of walls) {
        expect(current.queue.some((point) => same(point, wall))).toBe(false);
        expect(current.visited.some((point) => same(point, wall))).toBe(false);
        expect(current.path.some((point) => same(point, wall))).toBe(false);
      }
    }
    expectSearch(steps, picture, start, goal);
  });

  it("reports no path when walls block the goal, including a diagonal step", () => {
    const diagonal = cells([".#", "#."]);
    const separated = cells(["..#", "###", "..."]);
    const corner = gridBfsSteps(diagonal, at(0, 0), at(1, 1));
    const region = gridBfsSteps(separated, at(0, 0), at(2, 2));

    expect(outline(corner)).toEqual([
      row(
        "enqueue",
        at(0, 0),
        [at(0, 0)],
        [],
        [],
        "Enqueue (0, 0). It is the start. The queue is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        at(0, 0),
        [],
        [at(0, 0)],
        [],
        "Dequeue (0, 0) and visit it. The queue is now empty, and the visited cells are (0, 0).",
      ),
      row(
        "no-path",
        null,
        [],
        [at(0, 0)],
        [],
        "The queue is empty, and (1, 1) was not reached. There is no path. The visited cells are (0, 0).",
      ),
    ]);
    expect(corner[2]?.queue).toBe(corner[1]?.queue);
    expect(corner[2]?.visited).toBe(corner[1]?.visited);
    expect(corner[2]?.path).toBe(corner[0]?.path);
    expect(corner.map((current) => current.action)).toEqual(["enqueue", "visit", "no-path"]);

    expect(outline(region)).toEqual([
      row(
        "enqueue",
        at(0, 0),
        [at(0, 0)],
        [],
        [],
        "Enqueue (0, 0). It is the start. The queue is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "visit",
        at(0, 0),
        [],
        [at(0, 0)],
        [],
        "Dequeue (0, 0) and visit it. The queue is now empty, and the visited cells are (0, 0).",
      ),
      row(
        "enqueue",
        at(0, 1),
        [at(0, 1)],
        [at(0, 0)],
        [],
        "Enqueue (0, 1). The queue is now (0, 1), and the visited cells are (0, 0).",
      ),
      row(
        "visit",
        at(0, 1),
        [],
        [at(0, 0), at(0, 1)],
        [],
        "Dequeue (0, 1) and visit it. The queue is now empty, and the visited cells are (0, 0), (0, 1).",
      ),
      row(
        "no-path",
        null,
        [],
        [at(0, 0), at(0, 1)],
        [],
        "The queue is empty, and (2, 2) was not reached. There is no path. The visited cells are (0, 0), (0, 1).",
      ),
    ]);
    expect(region.at(-1)?.path).toEqual([]);
    expect(region.at(-1)?.visited).toEqual([at(0, 0), at(0, 1)]);
    expectSearch(corner, diagonal, at(0, 0), at(1, 1));
    expectSearch(region, separated, at(0, 0), at(2, 2));
  });

  it("stops on the start when the start is the goal", () => {
    const picture = cells(["...", "...", "..."]);
    const corner = gridBfsSteps(picture, at(0, 0), at(0, 0));
    const middle = gridBfsSteps(picture, at(1, 1), at(1, 1));
    const alone = gridBfsSteps(cells(["."]), at(0, 0), at(0, 0));

    expect(outline(corner)).toEqual([
      row(
        "enqueue",
        at(0, 0),
        [at(0, 0)],
        [],
        [],
        "Enqueue (0, 0). It is the start. The queue is (0, 0), and no cell has been visited yet.",
      ),
      row(
        "found",
        at(0, 0),
        [],
        [at(0, 0)],
        [at(0, 0)],
        "Dequeue (0, 0). It is the goal. The shortest path is (0, 0), which is 0 steps.",
      ),
    ]);
    expect(corner).toHaveLength(2);
    expect(corner[1]?.path).toHaveLength(1);
    expect(corner[1]?.start).toBe(corner[1]?.goal);
    expect(corner[1]?.cell).toBe(corner[1]?.start);
    expect(corner[1]?.path[0]).toBe(corner[1]?.start);
    expect(corner.map((current) => current.action)).not.toContain("visit");
    expect(corner.map((current) => current.action)).not.toContain("no-path");

    expect(middle.map((current) => current.action)).toEqual(["enqueue", "found"]);
    expect(middle[0]?.cell).toEqual(at(1, 1));
    expect(middle[1]?.path).toEqual([at(1, 1)]);
    expect(middle[1]?.visited).toEqual([at(1, 1)]);
    expect(middle[1]?.queue).toEqual([]);
    expect(middle[1]?.message).toBe(
      "Dequeue (1, 1). It is the goal. The shortest path is (1, 1), which is 0 steps.",
    );

    expect(alone.map((current) => current.action)).toEqual(["enqueue", "found"]);
    expect(alone[1]?.path).toEqual([at(0, 0)]);
    expect(alone[1]?.grid).toEqual([["open"]]);
    expectSearch(corner, picture, at(0, 0), at(0, 0));
    expectSearch(middle, picture, at(1, 1), at(1, 1));
    expectSearch(alone, cells(["."]), at(0, 0), at(0, 0));
  });

  it("keeps a shortest-path length, including one step in each direction", () => {
    const open = cells(["....", "....", "...."]);
    for (let startRow = 0; startRow < open.length; startRow += 1) {
      for (let startColumn = 0; startColumn < 4; startColumn += 1) {
        for (let goalRow = 0; goalRow < open.length; goalRow += 1) {
          for (let goalColumn = 0; goalColumn < 4; goalColumn += 1) {
            const start = at(startRow, startColumn);
            const goal = at(goalRow, goalColumn);
            const steps = gridBfsSteps(open, start, goal);
            const found = steps.at(-1);
            expect(found?.action).toBe("found");
            const length = manhattan(start, goal);
            expect(found?.path).toHaveLength(length + 1);
            let previousDistance = -1;
            for (const current of steps) {
              if (current.action !== "visit" && current.action !== "found") continue;
              if (current.cell === null) throw new Error("Missing a dequeued cell.");
              const distance = manhattan(current.cell, start);
              expect(distance).toBeGreaterThanOrEqual(previousDistance);
              previousDistance = distance;
            }
            expect(previousDistance).toBe(length);
            expectSearch(steps, open, start, goal);
          }
        }
      }
    }

    const up = gridBfsSteps(cells([".", "."]), at(1, 0), at(0, 0));
    const down = gridBfsSteps(cells([".", "."]), at(0, 0), at(1, 0));
    const left = gridBfsSteps(cells([".."]), at(0, 1), at(0, 0));
    const right = gridBfsSteps(cells([".."]), at(0, 0), at(0, 1));
    expect(up.at(-1)?.path).toEqual([at(1, 0), at(0, 0)]);
    expect(down.at(-1)?.path).toEqual([at(0, 0), at(1, 0)]);
    expect(left.at(-1)?.path).toEqual([at(0, 1), at(0, 0)]);
    expect(right.at(-1)?.path).toEqual([at(0, 0), at(0, 1)]);
    expect(right.at(-1)?.message).toBe(
      "Dequeue (0, 1). It is the goal. The shortest path is (0, 0), (0, 1), which is 1 step.",
    );
    expect(up.at(-1)?.path).toHaveLength(2);
    expect(down.at(-1)?.path).toHaveLength(2);
    expect(left.at(-1)?.path).toHaveLength(2);
    expectSearch(up, cells([".", "."]), at(1, 0), at(0, 0));
    expectSearch(left, cells([".."]), at(0, 1), at(0, 0));
  });

  it("does not mutate the grid or the cells, and freezes every snapshot", () => {
    const picture = cells(["..", ".."]);
    const top = picture[0];
    if (top === undefined) throw new Error("Missing a row.");
    const start = { row: 0, column: 0 };
    const goal = { row: 1, column: 1 };
    const steps = gridBfsSteps(picture, start, goal);

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
    expect(steps.at(-1)?.message).toBe(
      "Dequeue (1, 1). It is the goal. The shortest path is (0, 0), (0, 1), (1, 1), which is 2 steps.",
    );

    expect(Object.isFrozen(steps[0]?.grid)).toBe(true);
    expect(Object.isFrozen(steps[0]?.grid[0])).toBe(true);
    expect(Object.isFrozen(steps[0]?.queue)).toBe(true);
    expect(Object.isFrozen(steps[0]?.visited)).toBe(true);
    expect(Object.isFrozen(steps[0]?.path)).toBe(true);
    expect(Object.isFrozen(steps.at(-1)?.path)).toBe(true);
    expect(() => {
      (steps[0]?.queue as GridPoint[]).push(at(0, 0));
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
    const frozenSteps = gridBfsSteps(
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
    expect(() => gridBfsSteps([], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridBfsSteps([[]], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridBfsSteps([["open"], ["open", "open"]], at(0, 0), at(0, 0))).toThrow(/rectangular/);
    expect(() => gridBfsSteps(null as unknown as readonly (readonly GridCell[])[], at(0, 0), at(0, 0))).toThrow(
      /rectangular/,
    );
    expect(() =>
      gridBfsSteps([["open", "blocked"]] as unknown as readonly (readonly GridCell[])[], at(0, 0), at(0, 0)),
    ).toThrow(/open or wall/);
    expect(() => gridBfsSteps(open, at(-1, 0), at(0, 0))).toThrow(/start cell to be on the grid/);
    expect(() => gridBfsSteps(open, at(0, 0), at(2, 0))).toThrow(/goal cell to be on the grid/);
    expect(() => gridBfsSteps(open, at(0, 1.5), at(0, 0))).toThrow(/integer/);
    expect(() => gridBfsSteps(open, at(Number.NaN, 0), at(0, 0))).toThrow(/integer/);
    expect(() => gridBfsSteps(open, null as unknown as GridPoint, at(0, 0))).toThrow(/point on the grid/);
    expect(() => gridBfsSteps(open, at(0, 0), null as unknown as GridPoint)).toThrow(/point on the grid/);
    expect(() => gridBfsSteps(cells(["#.", ".."]), at(0, 0), at(1, 1))).toThrow(/start cell to be open/);
    expect(() => gridBfsSteps(cells(["..", "#."]), at(0, 0), at(1, 0))).toThrow(/goal cell to be open/);
    expect(() => gridBfsSteps(cells(["."]), at(0, 0), at(0, 0))).not.toThrow();
  });
});

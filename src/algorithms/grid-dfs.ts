import type { GridCell, GridPoint } from "./grid-bfs.ts";

export type { GridCell, GridPoint };

export type GridDfsAction = "push" | "visit" | "backtrack" | "found" | "no-path";

export interface GridDfsStep {
  /** Grid as given, row by column. The same frozen grid on every step. */
  readonly grid: readonly (readonly GridCell[])[];
  readonly start: GridPoint;
  readonly goal: GridPoint;
  readonly action: GridDfsAction;
  /** Cell pushed or popped. Null when there is no path. */
  readonly cell: GridPoint | null;
  /**
   * Frontier after this step. Index 0 is the bottom and the last index is the top.
   * A cell on the stack is not visited yet, so the two sets stay disjoint.
   */
  readonly stack: readonly GridPoint[];
  /** Cells popped so far, in that order. */
  readonly visited: readonly GridPoint[];
  /**
   * Path from the start to the goal, inclusive, on the found step.
   * Empty on every other step. This is the path the search followed.
   */
  readonly path: readonly GridPoint[];
  readonly message: string;
}

/** Up, right, down, left. The first open neighbor in this order is pushed last, so it is popped first. */
const DIRECTIONS = [
  { row: -1, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
] as const;

const NO_CELLS: readonly GridPoint[] = Object.freeze([]);

/**
 * Record a depth-first search from a start cell to a goal cell on a small
 * grid. Open cells can be entered. Walls cannot. From each visited cell the
 * search looks up, then right, then down, then left.
 *
 * The caller's grid and cells are copied, and each snapshot is frozen, so
 * later edits do not rewrite old steps. The start and the goal must be open
 * cells on the grid.
 *
 * The search begins by pushing the start onto an explicit stack. A cell is
 * popped from the top, and that is a visit, unless the cell is the goal.
 * Popping a cell whose parent is not the cell just visited is a backtrack:
 * the branch just left was a dead end. Popping the goal ends the search and
 * reconstructs the path the search followed, which can be longer than a
 * shortest path. An open neighbor is pushed only when it is not already on
 * the stack or in the visited cells, so each cell is pushed once. Visited
 * cells are the cells that have been popped, in that order. If the stack
 * empties before the goal is popped, there is no path.
 */
export function gridDfsSteps(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
): GridDfsStep[] {
  const field = copyGrid(grid);
  const columns = widthOf(field);
  const startCell = placePoint(start, "start", field, columns);
  let goalCell = placePoint(goal, "goal", field, columns);
  if (samePoint(startCell, goalCell)) goalCell = startCell;

  const steps: GridDfsStep[] = [];
  const discovered = new Set<string>();
  const parent = new Map<string, GridPoint | null>();
  const frontier: GridPoint[] = [];
  const visited: GridPoint[] = [];
  let visitedSnapshot: readonly GridPoint[] = NO_CELLS;

  push(startCell, null);

  while (frontier.length > 0) {
    const cell = takeTop();
    const stackSnapshot = snapshot(frontier);
    const backtracked = isBacktrack(cell);
    if (samePoint(cell, goalCell)) {
      steps.push(
        step(
          field,
          startCell,
          goalCell,
          "found",
          cell,
          stackSnapshot,
          visitedSnapshot,
          reconstruct(cell, parent),
          backtracked,
        ),
      );
      return steps;
    }
    steps.push(
      step(
        field,
        startCell,
        goalCell,
        backtracked ? "backtrack" : "visit",
        cell,
        stackSnapshot,
        visitedSnapshot,
        NO_CELLS,
      ),
    );
    expand(cell);
  }

  steps.push(step(field, startCell, goalCell, "no-path", null, snapshot(frontier), visitedSnapshot, NO_CELLS));
  return steps;

  function push(cell: GridPoint, from: GridPoint | null): void {
    if (from === null) {
      if (visited.length !== 0 || frontier.length !== 0) {
        throw new Error("Only the start is pushed before any visit.");
      }
    } else if (!visited.some((item) => samePoint(item, from))) {
      throw new Error("A neighbor was pushed from a cell that has not been visited.");
    }
    discovered.add(key(cell));
    parent.set(key(cell), from);
    frontier.push(cell);
    steps.push(step(field, startCell, goalCell, "push", cell, snapshot(frontier), visitedSnapshot, NO_CELLS));
  }

  function takeTop(): GridPoint {
    const cell = frontier.pop();
    if (cell === undefined) throw new Error("The stack was empty.");
    visited.push(cell);
    visitedSnapshot = Object.freeze(visited.slice());
    return cell;
  }

  function isBacktrack(cell: GridPoint): boolean {
    const previous = visited[visited.length - 2];
    const from = parent.get(key(cell));
    if (from === undefined) throw new Error("A popped cell is missing a parent.");
    if (from === null) {
      if (previous === undefined) return false;
      throw new Error("The start was popped after another cell.");
    }
    if (previous === undefined) return false;
    return !samePoint(from, previous);
  }

  function expand(cell: GridPoint): void {
    const neighbors: GridPoint[] = [];
    for (const direction of DIRECTIONS) {
      const row = cell.row + direction.row;
      const column = cell.column + direction.column;
      if (!inside(field, columns, row, column)) continue;
      if (cellAt(field, row, column) !== "open") continue;
      if (discovered.has(keyOf(row, column))) continue;
      neighbors.push(pointAt(row, column));
    }
    neighbors.reverse();
    for (const neighbor of neighbors) push(neighbor, cell);
  }

  function pointAt(row: number, column: number): GridPoint {
    if (row === goalCell.row && column === goalCell.column) return goalCell;
    return Object.freeze({ row, column });
  }
}

function copyGrid(grid: readonly (readonly GridCell[])[]): readonly (readonly GridCell[])[] {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new RangeError("gridDfsSteps expects a rectangular grid.");
  }
  const first = grid[0];
  if (!Array.isArray(first) || first.length === 0) {
    throw new RangeError("gridDfsSteps expects a rectangular grid.");
  }
  const width = first.length;
  const rows = grid.map((row) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new RangeError("gridDfsSteps expects a rectangular grid.");
    }
    return Object.freeze(
      row.map((cell) => {
        if (cell !== "open" && cell !== "wall") {
          throw new RangeError("gridDfsSteps expects open or wall cells.");
        }
        return cell;
      }),
    );
  });
  return Object.freeze(rows);
}

function widthOf(grid: readonly (readonly GridCell[])[]): number {
  const first = grid[0];
  if (first === undefined || first.length === 0) {
    throw new RangeError("gridDfsSteps expects a rectangular grid.");
  }
  return first.length;
}

function placePoint(
  point: GridPoint,
  label: "start" | "goal",
  grid: readonly (readonly GridCell[])[],
  columns: number,
): GridPoint {
  const { row, column } = readPoint(point, label);
  if (!inside(grid, columns, row, column)) {
    throw new RangeError(`gridDfsSteps expects the ${label} cell to be on the grid.`);
  }
  if (cellAt(grid, row, column) !== "open") {
    throw new RangeError(`gridDfsSteps expects the ${label} cell to be open.`);
  }
  return Object.freeze({ row, column });
}

function readPoint(point: GridPoint, label: "start" | "goal"): { row: number; column: number } {
  const record = point as { row?: unknown; column?: unknown } | null;
  if (record === null || typeof record !== "object") {
    throw new RangeError(`gridDfsSteps expects the ${label} cell to be a point on the grid.`);
  }
  const { row, column } = record;
  if (typeof row !== "number" || typeof column !== "number" || !Number.isInteger(row) || !Number.isInteger(column)) {
    throw new RangeError(`gridDfsSteps expects the ${label} cell to use integer coordinates.`);
  }
  return { row, column };
}

function inside(
  grid: readonly (readonly GridCell[])[],
  columns: number,
  row: number,
  column: number,
): boolean {
  return row >= 0 && column >= 0 && row < grid.length && column < columns;
}

function cellAt(grid: readonly (readonly GridCell[])[], row: number, column: number): GridCell {
  const line = grid[row];
  const cell = line?.[column];
  if (cell === undefined) throw new RangeError("Grid index fell outside the grid.");
  return cell;
}

function reconstruct(goal: GridPoint, parent: ReadonlyMap<string, GridPoint | null>): readonly GridPoint[] {
  const path: GridPoint[] = [];
  const seen = new Set<string>();
  let cursor: GridPoint | null = goal;
  while (cursor !== null) {
    const id = key(cursor);
    if (seen.has(id)) throw new Error("The path to the goal repeats a cell.");
    seen.add(id);
    path.push(cursor);
    const previous = parent.get(id);
    if (previous === undefined) throw new Error("The path to the goal is missing a parent.");
    cursor = previous;
  }
  path.reverse();
  return Object.freeze(path);
}

function snapshot(points: readonly GridPoint[]): readonly GridPoint[] {
  if (points.length === 0) return NO_CELLS;
  return Object.freeze(points.slice());
}

function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.row === right.row && left.column === right.column;
}

function key(point: GridPoint): string {
  return keyOf(point.row, point.column);
}

function keyOf(row: number, column: number): string {
  return `${row},${column}`;
}

function step(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  action: GridDfsAction,
  cell: GridPoint | null,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
  foundByBacktrack = false,
): GridDfsStep {
  return {
    grid,
    start,
    goal,
    action,
    cell,
    stack,
    visited,
    path,
    message: describe(grid, start, goal, action, cell, stack, visited, path, foundByBacktrack),
  };
}

function describe(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  action: GridDfsAction,
  cell: GridPoint | null,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
  foundByBacktrack: boolean,
): string {
  assertUnique(stack, "stack");
  assertUnique(visited, "visited");
  assertDisjoint(stack, visited);
  assertOpen(grid, stack);
  assertOpen(grid, visited);
  switch (action) {
    case "push":
      if (foundByBacktrack) throw new RangeError("A push step backtracks.");
      return describePush(grid, start, requireCell(cell), stack, visited, path);
    case "visit":
      if (foundByBacktrack) throw new RangeError("A visit step backtracks.");
      return describeVisit(goal, requireCell(cell), stack, visited, path);
    case "backtrack":
      if (foundByBacktrack) throw new RangeError("A backtrack step is marked as finding the goal.");
      return describeBacktrack(start, goal, requireCell(cell), stack, visited, path);
    case "found":
      return describeFound(grid, start, goal, requireCell(cell), stack, visited, path, foundByBacktrack);
    case "no-path":
      if (foundByBacktrack) throw new RangeError("A no-path step backtracks.");
      return describeNoPath(goal, cell, stack, visited, path);
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected grid search action: ${String(unexpected)}`);
    }
  }
}

function describePush(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  cell: GridPoint,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (path.length !== 0) throw new RangeError("A push step reconstructs a path.");
  const top = stack[stack.length - 1];
  if (top === undefined || !samePoint(top, cell)) {
    throw new RangeError("A push step does not add its cell to the top of the stack.");
  }
  if (contains(visited, cell)) {
    throw new RangeError("A push step visits a cell before it is popped.");
  }
  requireOpen(grid, cell);
  if (visited.length === 0) {
    if (!samePoint(cell, start) || stack.length !== 1) {
      throw new RangeError("The first push is not the start cell.");
    }
    return `Push ${formatPoint(cell)}. It is the start. The stack is ${formatPoint(cell)}, and no cell has been visited yet.`;
  }
  return `Push ${formatPoint(cell)}. The stack is now ${stackPhrase(stack)}, and the visited cells are ${formatCells(visited)}.`;
}

function describeVisit(
  goal: GridPoint,
  cell: GridPoint,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (path.length !== 0) throw new RangeError("A visit step reconstructs a path.");
  if (samePoint(cell, goal)) throw new RangeError("A visit step pops the goal.");
  const last = visited[visited.length - 1];
  if (last === undefined || !samePoint(last, cell)) {
    throw new RangeError("A visit step does not record the popped cell.");
  }
  if (contains(stack, cell)) throw new RangeError("A visit step leaves the cell on the stack.");
  return `Pop ${formatPoint(cell)} and visit it. The stack is now ${stackPhrase(stack)}, and the visited cells are ${formatCells(visited)}.`;
}

function describeBacktrack(
  start: GridPoint,
  goal: GridPoint,
  cell: GridPoint,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (path.length !== 0) throw new RangeError("A backtrack step reconstructs a path.");
  if (samePoint(cell, goal)) throw new RangeError("A backtrack step pops the goal.");
  if (samePoint(cell, start)) throw new RangeError("A backtrack step pops the start.");
  if (visited.length < 3) throw new RangeError("A backtrack step has not left a dead end.");
  const last = visited[visited.length - 1];
  if (last === undefined || !samePoint(last, cell)) {
    throw new RangeError("A backtrack step does not record the popped cell.");
  }
  if (contains(stack, cell)) throw new RangeError("A backtrack step leaves the cell on the stack.");
  return `Backtrack to ${formatPoint(cell)} and visit it. The stack is now ${stackPhrase(stack)}, and the visited cells are ${formatCells(visited)}.`;
}

function describeFound(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  cell: GridPoint,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
  foundByBacktrack: boolean,
): string {
  if (!samePoint(cell, goal)) throw new RangeError("A found step does not pop the goal.");
  if (contains(stack, cell)) throw new RangeError("A found step leaves the goal on the stack.");
  const last = visited[visited.length - 1];
  if (last === undefined || !samePoint(last, cell)) {
    throw new RangeError("A found step does not visit the goal.");
  }
  if (foundByBacktrack && visited.length < 3) {
    throw new RangeError("A found step backtracks before a dead end.");
  }
  assertPath(grid, start, cell, visited, path);
  const steps = path.length - 1;
  const length = steps === 1 ? "1 step" : `${steps} steps`;
  const verb = foundByBacktrack ? `Backtrack to ${formatPoint(cell)}` : `Pop ${formatPoint(cell)}`;
  return `${verb}. It is the goal. The path is ${formatCells(path)}, which is ${length}.`;
}

function describeNoPath(
  goal: GridPoint,
  cell: GridPoint | null,
  stack: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (cell !== null) throw new RangeError("A no-path step names a cell.");
  if (path.length !== 0) throw new RangeError("A no-path step names a path.");
  if (stack.length !== 0) throw new RangeError("A no-path step still has cells waiting.");
  if (visited.length === 0) throw new RangeError("A no-path step visited nothing.");
  if (contains(visited, goal)) throw new RangeError("A no-path step already reached the goal.");
  return `The stack is empty, and ${formatPoint(goal)} was not reached. There is no path. The visited cells are ${formatCells(visited)}.`;
}

function assertPath(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): void {
  const first = path[0];
  const last = path[path.length - 1];
  if (first === undefined || last === undefined || !samePoint(first, start) || !samePoint(last, goal)) {
    throw new RangeError("A found step does not reconstruct the path from the start to the goal.");
  }
  const seen = new Set<string>();
  let previousIndex = -1;
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (point === undefined) throw new RangeError("A found step is missing a path cell.");
    if (!contains(visited, point)) throw new RangeError("A path leaves the visited cells.");
    const visitedIndex = visited.findIndex((item) => samePoint(item, point));
    if (visitedIndex <= previousIndex) throw new RangeError("A path visits a cell before its parent.");
    previousIndex = visitedIndex;
    requireOpen(grid, point);
    const id = key(point);
    if (seen.has(id)) throw new RangeError("A path repeats a cell.");
    seen.add(id);
    if (index === 0) continue;
    const previous = path[index - 1];
    if (previous === undefined || !isNeighbor(previous, point)) {
      throw new RangeError("A path is not a walk along the grid.");
    }
  }
}

function assertUnique(points: readonly GridPoint[], label: string): void {
  const seen = new Set<string>();
  for (const point of points) {
    const id = key(point);
    if (seen.has(id)) throw new RangeError(`A grid search step repeats a ${label} cell.`);
    seen.add(id);
  }
}

function assertDisjoint(stack: readonly GridPoint[], visited: readonly GridPoint[]): void {
  const seen = new Set(visited.map((point) => key(point)));
  for (const point of stack) {
    if (seen.has(key(point))) {
      throw new RangeError("A cell is on the stack and in the visited cells.");
    }
  }
}

function assertOpen(grid: readonly (readonly GridCell[])[], points: readonly GridPoint[]): void {
  for (const point of points) requireOpen(grid, point);
}

function requireOpen(grid: readonly (readonly GridCell[])[], point: GridPoint): void {
  if (cellAt(grid, point.row, point.column) !== "open") {
    throw new RangeError("A grid search step leaves the open cells.");
  }
}

function requireCell(cell: GridPoint | null): GridPoint {
  if (cell === null) throw new RangeError("A grid search step is missing its cell.");
  return cell;
}

function contains(points: readonly GridPoint[], point: GridPoint): boolean {
  return points.some((item) => samePoint(item, point));
}

function isNeighbor(left: GridPoint, right: GridPoint): boolean {
  return Math.abs(left.row - right.row) + Math.abs(left.column - right.column) === 1;
}

function stackPhrase(stack: readonly GridPoint[]): string {
  if (stack.length === 0) return "empty";
  if (stack.length === 1) return formatPoint(only(stack));
  return `${formatCells(stack)}, bottom to top`;
}

function only(stack: readonly GridPoint[]): GridPoint {
  const point = stack[0];
  if (point === undefined) throw new RangeError("A stack cell is missing.");
  return point;
}

function formatCells(points: readonly GridPoint[]): string {
  return points.map((point) => formatPoint(point)).join(", ");
}

function formatPoint(point: GridPoint): string {
  return `(${point.row}, ${point.column})`;
}

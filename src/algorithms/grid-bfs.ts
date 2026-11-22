export type GridCell = "open" | "wall";

export interface GridPoint {
  readonly row: number;
  readonly column: number;
}

export type GridBfsAction = "enqueue" | "visit" | "found" | "no-path";

export interface GridBfsStep {
  /** Grid as given, row by column. The same frozen grid on every step. */
  readonly grid: readonly (readonly GridCell[])[];
  readonly start: GridPoint;
  readonly goal: GridPoint;
  readonly action: GridBfsAction;
  /** Cell enqueued or dequeued. Null when there is no path. */
  readonly cell: GridPoint | null;
  /** Frontier after this step. Index 0 is the front. */
  readonly queue: readonly GridPoint[];
  /** Cells dequeued so far, in that order. */
  readonly visited: readonly GridPoint[];
  /**
   * Shortest path from the start to the goal, inclusive, on the found step.
   * Empty on every other step.
   */
  readonly path: readonly GridPoint[];
  readonly message: string;
}

/** Up, right, down, left. The first open neighbor in this order is enqueued first. */
const DIRECTIONS = [
  { row: -1, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
] as const;

const NO_CELLS: readonly GridPoint[] = Object.freeze([]);

/**
 * Record a breadth-first search from a start cell to a goal cell on a small
 * grid. Open cells can be entered. Walls cannot. From each visited cell the
 * search looks up, then right, then down, then left.
 *
 * The caller's grid and cells are copied, and each snapshot is frozen, so
 * later edits do not rewrite old steps. The start and the goal must be open
 * cells on the grid.
 *
 * The search begins by enqueueing the start. A cell is dequeued from the
 * front of the frontier, and that is a visit, unless the cell is the goal.
 * Dequeuing the goal ends the search and reconstructs a shortest path. An
 * open neighbor is enqueued only when it is not already in the frontier or
 * the visited cells, so each cell is enqueued once. Visited cells are the
 * cells that have been dequeued, in that order. If the frontier empties
 * before the goal is dequeued, there is no path.
 */
export function gridBfsSteps(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
): GridBfsStep[] {
  const field = copyGrid(grid);
  const columns = widthOf(field);
  const startCell = placePoint(start, "start", field, columns);
  let goalCell = placePoint(goal, "goal", field, columns);
  if (samePoint(startCell, goalCell)) goalCell = startCell;

  const steps: GridBfsStep[] = [];
  const discovered = new Set<string>();
  const parent = new Map<string, GridPoint | null>();
  const frontier: GridPoint[] = [];
  const visited: GridPoint[] = [];
  let visitedSnapshot: readonly GridPoint[] = NO_CELLS;

  enqueue(startCell, null);

  while (frontier.length > 0) {
    const cell = takeFront();
    const queueSnapshot = snapshot(frontier);
    if (samePoint(cell, goalCell)) {
      steps.push(
        step(field, startCell, goalCell, "found", cell, queueSnapshot, visitedSnapshot, reconstruct(cell, parent)),
      );
      return steps;
    }
    steps.push(step(field, startCell, goalCell, "visit", cell, queueSnapshot, visitedSnapshot, NO_CELLS));
    expand(cell);
  }

  steps.push(step(field, startCell, goalCell, "no-path", null, snapshot(frontier), visitedSnapshot, NO_CELLS));
  return steps;

  function enqueue(cell: GridPoint, from: GridPoint | null): void {
    discovered.add(key(cell));
    parent.set(key(cell), from);
    frontier.push(cell);
    steps.push(step(field, startCell, goalCell, "enqueue", cell, snapshot(frontier), visitedSnapshot, NO_CELLS));
  }

  function takeFront(): GridPoint {
    const cell = frontier.shift();
    if (cell === undefined) throw new Error("The frontier was empty.");
    visited.push(cell);
    visitedSnapshot = Object.freeze(visited.slice());
    return cell;
  }

  function expand(cell: GridPoint): void {
    for (const direction of DIRECTIONS) {
      const row = cell.row + direction.row;
      const column = cell.column + direction.column;
      if (!inside(field, columns, row, column)) continue;
      if (cellAt(field, row, column) !== "open") continue;
      if (discovered.has(keyOf(row, column))) continue;
      enqueue(pointAt(row, column), cell);
    }
  }

  function pointAt(row: number, column: number): GridPoint {
    if (row === goalCell.row && column === goalCell.column) return goalCell;
    return Object.freeze({ row, column });
  }
}

function copyGrid(grid: readonly (readonly GridCell[])[]): readonly (readonly GridCell[])[] {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new RangeError("gridBfsSteps expects a rectangular grid.");
  }
  const first = grid[0];
  if (!Array.isArray(first) || first.length === 0) {
    throw new RangeError("gridBfsSteps expects a rectangular grid.");
  }
  const width = first.length;
  const rows = grid.map((row) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new RangeError("gridBfsSteps expects a rectangular grid.");
    }
    return Object.freeze(
      row.map((cell) => {
        if (cell !== "open" && cell !== "wall") {
          throw new RangeError("gridBfsSteps expects open or wall cells.");
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
    throw new RangeError("gridBfsSteps expects a rectangular grid.");
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
    throw new RangeError(`gridBfsSteps expects the ${label} cell to be on the grid.`);
  }
  if (cellAt(grid, row, column) !== "open") {
    throw new RangeError(`gridBfsSteps expects the ${label} cell to be open.`);
  }
  return Object.freeze({ row, column });
}

function readPoint(point: GridPoint, label: "start" | "goal"): { row: number; column: number } {
  const record = point as { row?: unknown; column?: unknown } | null;
  if (record === null || typeof record !== "object") {
    throw new RangeError(`gridBfsSteps expects the ${label} cell to be a point on the grid.`);
  }
  const { row, column } = record;
  if (typeof row !== "number" || typeof column !== "number" || !Number.isInteger(row) || !Number.isInteger(column)) {
    throw new RangeError(`gridBfsSteps expects the ${label} cell to use integer coordinates.`);
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

function reconstruct(
  goal: GridPoint,
  parent: ReadonlyMap<string, GridPoint | null>,
): readonly GridPoint[] {
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
  action: GridBfsAction,
  cell: GridPoint | null,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): GridBfsStep {
  return {
    grid,
    start,
    goal,
    action,
    cell,
    queue,
    visited,
    path,
    message: describe(grid, start, goal, action, cell, queue, visited, path),
  };
}

function describe(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  action: GridBfsAction,
  cell: GridPoint | null,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  assertUnique(queue, "queue");
  assertUnique(visited, "visited");
  assertDisjoint(queue, visited);
  assertOpen(grid, queue);
  assertOpen(grid, visited);
  switch (action) {
    case "enqueue":
      return describeEnqueue(grid, start, requireCell(cell), queue, visited, path);
    case "visit":
      return describeVisit(goal, requireCell(cell), queue, visited, path);
    case "found":
      return describeFound(grid, start, goal, requireCell(cell), queue, visited, path);
    case "no-path":
      return describeNoPath(goal, cell, queue, visited, path);
    default: {
      const unexpected: never = action;
      throw new Error(`Unexpected grid search action: ${String(unexpected)}`);
    }
  }
}

function describeEnqueue(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  cell: GridPoint,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (path.length !== 0) throw new RangeError("An enqueue step reconstructs a path.");
  const back = queue[queue.length - 1];
  if (back === undefined || !samePoint(back, cell)) {
    throw new RangeError("An enqueue step does not add its cell to the back of the queue.");
  }
  if (contains(visited, cell)) {
    throw new RangeError("An enqueue step visits a cell before it is dequeued.");
  }
  requireOpen(grid, cell);
  if (visited.length === 0) {
    if (!samePoint(cell, start) || queue.length !== 1) {
      throw new RangeError("The first enqueue is not the start cell.");
    }
    return `Enqueue ${formatPoint(cell)}. It is the start. The queue is ${formatPoint(cell)}, and no cell has been visited yet.`;
  }
  return `Enqueue ${formatPoint(cell)}. The queue is now ${queuePhrase(queue)}, and the visited cells are ${formatCells(visited)}.`;
}

function describeVisit(
  goal: GridPoint,
  cell: GridPoint,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (path.length !== 0) throw new RangeError("A visit step reconstructs a path.");
  if (samePoint(cell, goal)) throw new RangeError("A visit step dequeues the goal.");
  const last = visited[visited.length - 1];
  if (last === undefined || !samePoint(last, cell)) {
    throw new RangeError("A visit step does not record the dequeued cell.");
  }
  if (contains(queue, cell)) throw new RangeError("A visit step leaves the cell in the queue.");
  return `Dequeue ${formatPoint(cell)} and visit it. The queue is now ${queuePhrase(queue)}, and the visited cells are ${formatCells(visited)}.`;
}

function describeFound(
  grid: readonly (readonly GridCell[])[],
  start: GridPoint,
  goal: GridPoint,
  cell: GridPoint,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (!samePoint(cell, goal)) throw new RangeError("A found step does not dequeue the goal.");
  if (contains(queue, cell)) throw new RangeError("A found step leaves the goal in the queue.");
  const last = visited[visited.length - 1];
  if (last === undefined || !samePoint(last, cell)) {
    throw new RangeError("A found step does not visit the goal.");
  }
  assertPath(grid, start, cell, visited, path);
  const steps = path.length - 1;
  const length = steps === 1 ? "1 step" : `${steps} steps`;
  return `Dequeue ${formatPoint(cell)}. It is the goal. The shortest path is ${formatCells(path)}, which is ${length}.`;
}

function describeNoPath(
  goal: GridPoint,
  cell: GridPoint | null,
  queue: readonly GridPoint[],
  visited: readonly GridPoint[],
  path: readonly GridPoint[],
): string {
  if (cell !== null) throw new RangeError("A no-path step names a cell.");
  if (path.length !== 0) throw new RangeError("A no-path step names a path.");
  if (queue.length !== 0) throw new RangeError("A no-path step still has cells waiting.");
  if (visited.length === 0) throw new RangeError("A no-path step visited nothing.");
  if (contains(visited, goal)) throw new RangeError("A no-path step already reached the goal.");
  return `The queue is empty, and ${formatPoint(goal)} was not reached. There is no path. The visited cells are ${formatCells(visited)}.`;
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
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (point === undefined) throw new RangeError("A found step is missing a path cell.");
    if (!contains(visited, point)) throw new RangeError("A shortest path leaves the visited cells.");
    requireOpen(grid, point);
    const id = key(point);
    if (seen.has(id)) throw new RangeError("A shortest path repeats a cell.");
    seen.add(id);
    if (index === 0) continue;
    const previous = path[index - 1];
    if (previous === undefined || !isNeighbor(previous, point)) {
      throw new RangeError("A shortest path is not a walk along the grid.");
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

function assertDisjoint(queue: readonly GridPoint[], visited: readonly GridPoint[]): void {
  const seen = new Set(visited.map((point) => key(point)));
  for (const point of queue) {
    if (seen.has(key(point))) {
      throw new RangeError("A cell is in the queue and the visited cells.");
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

function queuePhrase(queue: readonly GridPoint[]): string {
  if (queue.length === 0) return "empty";
  if (queue.length === 1) return formatPoint(only(queue));
  return `${formatCells(queue)}, front to back`;
}

function only(queue: readonly GridPoint[]): GridPoint {
  const point = queue[0];
  if (point === undefined) throw new RangeError("A queue cell is missing.");
  return point;
}

function formatCells(points: readonly GridPoint[]): string {
  return points.map((point) => formatPoint(point)).join(", ");
}

function formatPoint(point: GridPoint): string {
  return `(${point.row}, ${point.column})`;
}

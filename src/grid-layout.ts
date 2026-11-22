import type { GridBfsStep, GridCell, GridPoint } from "./algorithms/grid-bfs.ts";

/** Side of one drawn cell, in pixels. */
export const GRID_CELL_SIZE = 44;
/** Space between neighboring cells, in pixels. */
export const GRID_CELL_GAP = 8;

export type GridShade = "wall" | "open" | "frontier" | "visited" | "current" | "path";

export interface GridCellView {
  readonly row: number;
  readonly column: number;
  readonly shade: GridShade;
  readonly start: boolean;
  readonly goal: boolean;
}

export interface GridFrame {
  readonly cells: readonly (readonly GridCellView[])[];
  readonly width: number;
  readonly height: number;
  readonly reached: boolean;
  readonly blocked: boolean;
}

/**
 * Map one breadth-first search step onto a grid of cell colors.
 * Walls stay walls. The cell this step enqueued or dequeued is current.
 * Other cells on the shortest path are path, but only after the goal is found.
 * Cells still in the queue are frontier, and cells already dequeued are visited.
 * The step's grid is not mutated.
 */
export function gridFrame(step: GridBfsStep): GridFrame {
  const columns = widthOf(step.grid);
  const rows = step.grid.length;
  const current = readCurrent(step, rows, columns);
  requireOpenPoint(step.grid, step.start, columns, "start");
  requireOpenPoint(step.grid, step.goal, columns, "goal");
  if (step.action === "found") {
    if (step.path.length === 0) throw new RangeError("A found step is missing its path.");
  } else if (step.path.length !== 0) {
    throw new RangeError("A grid step names a path before the goal is found.");
  }

  const frontier = pointSet(step.queue, rows, columns, "frontier");
  const visited = pointSet(step.visited, rows, columns, "visited");
  const path = pointSet(step.path, rows, columns, "path");
  assertDisjoint(frontier, visited);
  if (current !== null) {
    const id = key(current.row, current.column);
    if (step.action === "enqueue" && !frontier.has(id)) {
      throw new RangeError("An enqueue step leaves its cell out of the frontier.");
    }
    if ((step.action === "visit" || step.action === "found") && !visited.has(id)) {
      throw new RangeError("A dequeued cell is missing from the visited cells.");
    }
    if (step.action === "found" && !path.has(id)) {
      throw new RangeError("A found step leaves the goal off the path.");
    }
  }

  const cells: GridCellView[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const line = step.grid[row];
    if (line === undefined) throw new RangeError("A grid frame is missing a row.");
    const placed: GridCellView[] = [];
    for (let column = 0; column < columns; column += 1) {
      const kind = line[column];
      if (kind !== "open" && kind !== "wall") {
        throw new RangeError("A grid frame expects open or wall cells.");
      }
      const id = key(row, column);
      const onPath = path.has(id);
      const inFrontier = frontier.has(id);
      const inVisited = visited.has(id);
      const isCurrent = current !== null && current.row === row && current.column === column;
      if (kind === "wall" && (onPath || inFrontier || inVisited || isCurrent)) {
        throw new RangeError("A wall is part of the search.");
      }
      placed.push({
        row,
        column,
        shade: shadeOf(kind, isCurrent, onPath, inFrontier, inVisited),
        start: step.start.row === row && step.start.column === column,
        goal: step.goal.row === row && step.goal.column === column,
      });
    }
    cells.push(placed);
  }

  return {
    cells,
    width: gridSpan(columns),
    height: gridSpan(rows),
    reached: step.action === "found",
    blocked: step.action === "no-path",
  };
}

/** Short caption under the grid for the current step. */
export function gridResultLabel(step: Pick<GridBfsStep, "action" | "path">): string {
  switch (step.action) {
    case "enqueue":
      return "enqueued";
    case "visit":
      return "visited";
    case "found":
      return pathCaption(step.path.length);
    case "no-path":
      return "no path";
    default: {
      const unexpected: never = step.action;
      throw new Error(`Unexpected grid search action: ${String(unexpected)}`);
    }
  }
}

/** Accessible name for one drawn cell, including why it is colored. */
export function gridCellLabel(cell: GridCellView): string {
  const place = `row ${cell.row}, column ${cell.column}`;
  const name = cellName(cell);
  switch (cell.shade) {
    case "wall":
    case "open":
      return `${name} at ${place}`;
    case "frontier":
      return `${name} at ${place}, in the frontier`;
    case "visited":
      return `${name} at ${place}, visited`;
    case "current":
      return `${name} at ${place}, current`;
    case "path":
      return `${name} at ${place}, on the shortest path`;
    default: {
      const unexpected: never = cell.shade;
      throw new Error(`Unexpected grid shade: ${String(unexpected)}`);
    }
  }
}

function cellName(cell: GridCellView): string {
  if (cell.start && cell.goal) return "start and goal";
  if (cell.start) return "start";
  if (cell.goal) return "goal";
  if (cell.shade === "wall") return "wall";
  return "open cell";
}

function pathCaption(length: number): string {
  const distance = length - 1;
  if (distance === 1) return "shortest path, 1 step";
  return `shortest path, ${distance} steps`;
}

function shadeOf(
  kind: GridCell,
  current: boolean,
  onPath: boolean,
  inFrontier: boolean,
  inVisited: boolean,
): GridShade {
  if (kind === "wall") return "wall";
  if (current) return "current";
  if (onPath) return "path";
  if (inFrontier) return "frontier";
  if (inVisited) return "visited";
  return "open";
}

function gridSpan(count: number): number {
  return count * GRID_CELL_SIZE + Math.max(0, count - 1) * GRID_CELL_GAP;
}

function widthOf(grid: readonly (readonly GridCell[])[]): number {
  const first = grid[0];
  if (first === undefined || first.length === 0) {
    throw new RangeError("A grid frame expects a rectangular grid.");
  }
  for (const row of grid) {
    if (row.length !== first.length) {
      throw new RangeError("A grid frame expects a rectangular grid.");
    }
  }
  return first.length;
}

function readCurrent(step: GridBfsStep, rows: number, columns: number): GridPoint | null {
  if (step.action === "no-path") {
    if (step.cell !== null) throw new RangeError("A no-path step names a cell.");
    return null;
  }
  if (step.cell === null) throw new RangeError("A grid step is missing its cell.");
  requireInside(step.cell, rows, columns, "current");
  return step.cell;
}

function requireOpenPoint(
  grid: readonly (readonly GridCell[])[],
  point: GridPoint,
  columns: number,
  label: "start" | "goal",
): void {
  requireInside(point, grid.length, columns, label);
  const kind = grid[point.row]?.[point.column];
  if (kind === "wall") throw new RangeError(`The ${label} cell is a wall.`);
  if (kind !== "open") throw new RangeError("A grid frame expects open or wall cells.");
}

function requireInside(point: GridPoint, rows: number, columns: number, label: string): void {
  if (
    !Number.isInteger(point.row) ||
    !Number.isInteger(point.column) ||
    point.row < 0 ||
    point.column < 0 ||
    point.row >= rows ||
    point.column >= columns
  ) {
    throw new RangeError(`The ${label} cell is off the grid.`);
  }
}

function pointSet(
  points: readonly GridPoint[],
  rows: number,
  columns: number,
  label: string,
): Set<string> {
  const seen = new Set<string>();
  for (const point of points) {
    requireInside(point, rows, columns, label);
    const id = key(point.row, point.column);
    if (seen.has(id)) throw new RangeError(`A ${label} cell is repeated.`);
    seen.add(id);
  }
  return seen;
}

function assertDisjoint(frontier: ReadonlySet<string>, visited: ReadonlySet<string>): void {
  for (const id of frontier) {
    if (visited.has(id)) {
      throw new RangeError("A cell is in the frontier and the visited cells.");
    }
  }
}

function key(row: number, column: number): string {
  return `${row},${column}`;
}

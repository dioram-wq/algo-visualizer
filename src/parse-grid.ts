import type { GridCell, GridPoint } from "./algorithms/grid-bfs.ts";

export interface ParsedGrid {
  readonly grid: GridCell[][];
  readonly start: GridPoint;
  readonly goal: GridPoint;
}

/**
 * Parse a small grid picture.
 * Each line is one row. Spaces, tabs, and commas are ignored.
 * `.` is open, `#` is a wall, `S` is the start, and `G` is the goal.
 * `@` is a cell that is both the start and the goal.
 * The picture must be rectangular and name exactly one start and one goal.
 */
export function parseGrid(text: string): ParsedGrid {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new Error(
      'Enter a grid. Use "." for open, "#" for a wall, "S" for the start, and "G" for the goal.',
    );
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.replace(/[\s,]+/g, ""));
  if (lines.some((line) => line.length === 0)) {
    throw new Error("The grid has a blank row.");
  }

  const width = lines[0]?.length ?? 0;

  const grid: GridCell[][] = [];
  let start: GridPoint | null = null;
  let goal: GridPoint | null = null;

  for (let row = 0; row < lines.length; row += 1) {
    const line = lines[row];
    if (line === undefined || line.length !== width) {
      throw new Error("The grid is not rectangular.");
    }
    const cells: GridCell[] = [];
    for (let column = 0; column < line.length; column += 1) {
      const symbol = line[column];
      if (symbol === undefined) {
        throw new Error("The grid is missing a cell.");
      }
      const kind = readSymbol(symbol, row, column);
      if (kind.start) {
        if (start !== null) throw new Error("The grid has more than one start.");
        start = { row, column };
      }
      if (kind.goal) {
        if (goal !== null) throw new Error("The grid has more than one goal.");
        goal = { row, column };
      }
      cells.push(kind.cell);
    }
    grid.push(cells);
  }

  if (start === null) {
    throw new Error('The grid is missing a start. Mark it with "S".');
  }
  if (goal === null) {
    throw new Error('The grid is missing a goal. Mark it with "G".');
  }
  return { grid, start, goal };
}

function readSymbol(
  symbol: string,
  row: number,
  column: number,
): { cell: GridCell; start: boolean; goal: boolean } {
  switch (symbol.toLowerCase()) {
    case ".":
      return { cell: "open", start: false, goal: false };
    case "#":
      return { cell: "wall", start: false, goal: false };
    case "s":
      return { cell: "open", start: true, goal: false };
    case "g":
      return { cell: "open", start: false, goal: true };
    case "@":
      return { cell: "open", start: true, goal: true };
    default:
      throw new Error(
        `"${symbol}" at row ${row}, column ${column} is not a grid cell. Use ".", "#", "S", "G", or "@".`,
      );
  }
}

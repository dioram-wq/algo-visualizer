import { describe, expect, it } from "vitest";
import { gridBfsSteps, type GridBfsStep, type GridPoint } from "./algorithms/grid-bfs.ts";
import {
  gridCellLabel,
  gridFrame,
  gridResultLabel,
  GRID_CELL_GAP,
  GRID_CELL_SIZE,
  type GridFrame,
} from "./grid-layout.ts";
import { parseGrid } from "./parse-grid.ts";
import { DEFAULT_GRID } from "./grid-view.ts";

function at(row: number, column: number): GridPoint {
  return { row, column };
}

function colors(frame: GridFrame): string[][] {
  return frame.cells.map((row) => row.map((cell) => cell.shade));
}

describe("gridFrame", () => {
  const source = [
    ["open", "open", "open"],
    ["open", "open", "open"],
  ] as const;
  const steps = gridBfsSteps(source, at(0, 0), at(0, 2));

  it("colors the frontier, the visited cells, the current cell, and the shortest path", () => {
    const before = source.map((row) => row.slice());
    const opening = gridFrame(steps[0] as GridBfsStep);
    expect(colors(opening)).toEqual([
      ["current", "open", "open"],
      ["open", "open", "open"],
    ]);
    expect(opening.cells[0]?.[0]).toMatchObject({ start: true, goal: false });
    expect(opening.cells[0]?.[2]).toMatchObject({ start: false, goal: true });
    expect(opening.reached).toBe(false);
    expect(opening.blocked).toBe(false);
    expect(opening.width).toBe(3 * GRID_CELL_SIZE + 2 * GRID_CELL_GAP);
    expect(opening.height).toBe(2 * GRID_CELL_SIZE + GRID_CELL_GAP);
    expect(source).toEqual(before);

    const queued = steps[3];
    if (queued === undefined) throw new Error("missing an enqueue");
    expect(colors(gridFrame(queued))).toEqual([
      ["visited", "frontier", "open"],
      ["current", "open", "open"],
    ]);

    const found = steps.at(-1);
    if (found === undefined) throw new Error("missing the path");
    const frame = gridFrame(found);
    expect(frame.reached).toBe(true);
    expect(frame.blocked).toBe(false);
    expect(colors(frame)).toEqual([
      ["path", "path", "current"],
      ["visited", "frontier", "open"],
    ]);
    expect(frame.cells[0]?.[2]).toMatchObject({ goal: true, shade: "current" });
  });

  it("leaves a blocked goal open and names no current cell", () => {
    const blocked = gridBfsSteps(
      [
        ["open", "wall"],
        ["wall", "open"],
      ],
      at(0, 0),
      at(1, 1),
    );
    const last = blocked.at(-1);
    if (last === undefined) throw new Error("missing the last step");
    expect(last.action).toBe("no-path");
    const frame = gridFrame(last);
    expect(frame.blocked).toBe(true);
    expect(frame.reached).toBe(false);
    expect(colors(frame)).toEqual([
      ["visited", "wall"],
      ["wall", "open"],
    ]);
    expect(frame.cells[1]?.[1]).toMatchObject({ goal: true, shade: "open" });
    expect(frame.width).toBe(2 * GRID_CELL_SIZE + GRID_CELL_GAP);
    expect(frame.height).toBe(2 * GRID_CELL_SIZE + GRID_CELL_GAP);
  });

  it("colors a cell that is both the start and the goal", () => {
    const same = gridBfsSteps([["open"]], at(0, 0), at(0, 0));
    expect(same.map((step) => step.action)).toEqual(["enqueue", "found"]);
    const frame = gridFrame(same[1] as GridBfsStep);
    expect(frame.reached).toBe(true);
    expect(frame.cells).toEqual([[{ row: 0, column: 0, shade: "current", start: true, goal: true }]]);
    expect(frame.width).toBe(GRID_CELL_SIZE);
    expect(frame.height).toBe(GRID_CELL_SIZE);
  });

  it("rejects a step that cannot be drawn", () => {
    const opening = steps[0];
    const found = steps.at(-1);
    if (opening === undefined || found === undefined) throw new Error("missing a step");

    expect(() => gridFrame({ ...opening, path: [at(0, 0)] })).toThrow(/path before the goal/);
    expect(() => gridFrame({ ...found, path: [] })).toThrow(/missing its path/);
    expect(() => gridFrame({ ...opening, cell: null })).toThrow(/missing its cell/);
    expect(() => gridFrame({ ...opening, queue: [at(4, 0)] })).toThrow(/frontier cell is off the grid/);
    expect(() => gridFrame({ ...opening, queue: [at(0, 0), at(0, 0)] })).toThrow(/frontier cell is repeated/);
    expect(() =>
      gridFrame({
        ...opening,
        queue: [at(0, 1)],
        visited: [at(0, 1)],
        cell: at(0, 1),
      }),
    ).toThrow(/frontier and the visited/);
    expect(() => gridFrame({ ...opening, queue: [] })).toThrow(/out of the frontier/);

    const walled = opening.grid.map((row) => row.slice());
    const top = walled[0];
    if (top === undefined) throw new Error("missing a row");
    top[0] = "wall";
    expect(() => gridFrame({ ...opening, grid: walled })).toThrow(/start cell is a wall/);

    expect(() =>
      gridFrame({
        ...opening,
        grid: [
          ["open", "open"],
          ["open"],
        ],
      }),
    ).toThrow(/rectangular/);
    expect(() => gridFrame({ ...opening, goal: at(3, 3) })).toThrow(/goal cell is off the grid/);
  });
});

describe("grid labels", () => {
  it("names the caption and the colored cell", () => {
    expect(gridResultLabel({ action: "enqueue", path: [] })).toBe("enqueued");
    expect(gridResultLabel({ action: "visit", path: [] })).toBe("visited");
    expect(gridResultLabel({ action: "found", path: [at(0, 0)] })).toBe("shortest path, 0 steps");
    expect(gridResultLabel({ action: "found", path: [at(0, 0), at(0, 1)] })).toBe("shortest path, 1 step");
    expect(gridResultLabel({ action: "found", path: [at(0, 0), at(0, 1), at(0, 2)] })).toBe(
      "shortest path, 2 steps",
    );
    expect(gridResultLabel({ action: "no-path", path: [] })).toBe("no path");

    expect(gridCellLabel({ row: 0, column: 2, shade: "wall", start: false, goal: false })).toBe(
      "wall at row 0, column 2",
    );
    expect(gridCellLabel({ row: 1, column: 1, shade: "open", start: false, goal: false })).toBe(
      "open cell at row 1, column 1",
    );
    expect(gridCellLabel({ row: 0, column: 0, shade: "current", start: true, goal: false })).toBe(
      "start at row 0, column 0, current",
    );
    expect(gridCellLabel({ row: 0, column: 2, shade: "frontier", start: false, goal: true })).toBe(
      "goal at row 0, column 2, in the frontier",
    );
    expect(gridCellLabel({ row: 1, column: 0, shade: "visited", start: false, goal: false })).toBe(
      "open cell at row 1, column 0, visited",
    );
    expect(gridCellLabel({ row: 0, column: 0, shade: "path", start: true, goal: false })).toBe(
      "start at row 0, column 0, on the shortest path",
    );
    expect(gridCellLabel({ row: 0, column: 0, shade: "current", start: true, goal: true })).toBe(
      "start and goal at row 0, column 0, current",
    );
  });
});

describe("default grid trace", () => {
  it("plays a walled grid through to a shortest path", () => {
    const parsed = parseGrid(DEFAULT_GRID);
    const trace = gridBfsSteps(parsed.grid, parsed.start, parsed.goal);
    expect(trace.some((step) => step.action === "enqueue")).toBe(true);
    expect(trace.some((step) => step.action === "visit")).toBe(true);
    const last = trace.at(-1);
    expect(last?.action).toBe("found");
    expect(last?.path).toHaveLength(6);
    for (const step of trace) {
      const frame = gridFrame(step);
      expect(frame.cells[0]?.[2]?.shade).toBe("wall");
      expect(frame.cells[1]?.[2]?.shade).toBe("wall");
      expect(frame.cells.flat().filter((cell) => cell.start)).toHaveLength(1);
      expect(frame.cells.flat().filter((cell) => cell.goal)).toHaveLength(1);
    }
    const found = gridFrame(last as GridBfsStep);
    expect(found.reached).toBe(true);
    expect(found.cells[2]?.[3]).toMatchObject({ shade: "current", goal: true });
    expect(found.cells.flat().filter((cell) => cell.shade === "path")).toHaveLength(5);
  });
});

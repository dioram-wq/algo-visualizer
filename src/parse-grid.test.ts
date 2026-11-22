import { describe, expect, it } from "vitest";
import { gridBfsSteps } from "./algorithms/grid-bfs.ts";
import { parseGrid } from "./parse-grid.ts";

describe("parseGrid", () => {
  it("reads rows, spaces, and the start and goal", () => {
    expect(parseGrid("S.#.\n..#.\n...G")).toEqual({
      grid: [
        ["open", "open", "wall", "open"],
        ["open", "open", "wall", "open"],
        ["open", "open", "open", "open"],
      ],
      start: { row: 0, column: 0 },
      goal: { row: 2, column: 3 },
    });
    expect(parseGrid(" s . \n. g ")).toEqual({
      grid: [
        ["open", "open"],
        ["open", "open"],
      ],
      start: { row: 0, column: 0 },
      goal: { row: 1, column: 1 },
    });
    expect(parseGrid("S, ., #\n., ., G")).toEqual({
      grid: [
        ["open", "open", "wall"],
        ["open", "open", "open"],
      ],
      start: { row: 0, column: 0 },
      goal: { row: 1, column: 2 },
    });
    expect(parseGrid("@#\r\n#.")).toEqual({
      grid: [
        ["open", "wall"],
        ["wall", "open"],
      ],
      start: { row: 0, column: 0 },
      goal: { row: 0, column: 0 },
    });
  });

  it("rejects a picture that is not one rectangular search", () => {
    expect(() => parseGrid("")).toThrow(/Enter a grid/);
    expect(() => parseGrid("   \n")).toThrow(/Enter a grid/);
    expect(() => parseGrid("S.\n\n.G")).toThrow(/blank row/);
    expect(() => parseGrid("S.\n.G.")).toThrow(/rectangular/);
    expect(() => parseGrid("S?\n.G")).toThrow(/"\?"/);
    expect(() => parseGrid("...\n.G.")).toThrow(/missing a start/);
    expect(() => parseGrid("S.\n..")).toThrow(/missing a goal/);
    expect(() => parseGrid("SS\n.G")).toThrow(/more than one start/);
    expect(() => parseGrid("S@\n..")).toThrow(/more than one start/);
    expect(() => parseGrid("SG\nG.")).toThrow(/more than one goal/);
    expect(() => parseGrid("@G")).toThrow(/more than one goal/);
  });

  it("leaves the parsed grid unchanged when the search runs", () => {
    const parsed = parseGrid("S.\n.G");
    const before = parsed.grid.map((row) => row.slice());
    const steps = gridBfsSteps(parsed.grid, parsed.start, parsed.goal);
    expect(parsed.grid).toEqual(before);
    expect(parsed.start).toEqual({ row: 0, column: 0 });
    expect(parsed.goal).toEqual({ row: 1, column: 1 });
    expect(steps.at(-1)?.action).toBe("found");
  });
});

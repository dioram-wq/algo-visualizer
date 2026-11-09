import { describe, expect, it } from "vitest";
import { parseFiniteNumber, parseNumberList } from "./parse-numbers.ts";

describe("parseNumberList", () => {
  it("accepts commas, spaces, and a blank empty array", () => {
    expect(parseNumberList("2, 5  8,12")).toEqual([2, 5, 8, 12]);
    expect(parseNumberList("")).toEqual([]);
    expect(parseNumberList("  ")).toEqual([]);
    expect(parseNumberList("-2, 0.5, +4")).toEqual([-2, 0.5, 4]);
  });

  it("rejects tokens that are not finite numbers", () => {
    expect(() => parseNumberList("1, abc")).toThrow(/abc/);
    expect(() => parseFiniteNumber("Infinity")).toThrow(/finite/);
  });
});

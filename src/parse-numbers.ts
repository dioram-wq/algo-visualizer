/** Parse a comma- or whitespace-separated list. A blank field is an empty array. */
export function parseNumberList(text: string): number[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  return trimmed.split(/[\s,]+/).filter(Boolean).map((token) => parseFiniteNumber(token));
}

export function parseFiniteNumber(token: string): number {
  if (token.trim() === "" || token.trim() !== token) {
    throw new Error(`"${token}" is not a finite number.`);
  }
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new Error(`"${token}" is not a finite number.`);
  }
  return value;
}

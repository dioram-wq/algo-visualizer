/**
 * Pseudocode panel for algorithms that opt in.
 * An algorithm exports a `CodeListing` and sets `line` on each step to a
 * 0-based index into that listing. The panel only highlights `line`. It does
 * not decide which line a step is on. Algorithms without a listing show nothing.
 */

export interface CodeListing {
  readonly lines: readonly string[];
}

/** A playback step that names its pseudocode line. `line` is 0-based. */
export interface CodeStep {
  readonly line: number;
}

export interface CodePanel {
  readonly element: HTMLElement;
  setLine(line: number | null): void;
}

/** Line to mark, or null when the step has nothing to highlight. */
export function highlightedLine(listing: CodeListing, line: number | null): number | null {
  if (line === null || !Number.isInteger(line) || line < 0 || line >= listing.lines.length) {
    return null;
  }
  return line;
}

/** Return `line` when it indexes `listing`, otherwise throw. */
export function codeLine(listing: CodeListing, line: number): number {
  if (highlightedLine(listing, line) !== line) {
    throw new RangeError(
      `Pseudocode line ${String(line)} is outside a listing of ${listing.lines.length} lines.`,
    );
  }
  return line;
}

/** Build the panel once. Later steps only change which line is current. */
export function createCodePanel(listing: CodeListing): CodePanel {
  if (listing.lines.length === 0) {
    throw new RangeError("A code listing needs at least one line.");
  }

  const panel = document.createElement("figure");
  panel.className = "code-panel";

  const caption = document.createElement("figcaption");
  caption.className = "code-caption";
  caption.textContent = "Pseudocode";

  const list = document.createElement("ol");
  list.className = "code-lines";

  const items: HTMLLIElement[] = [];
  for (const text of listing.lines) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = text;
    item.append(code);
    items.push(item);
  }
  list.append(...items);
  panel.append(caption, list);

  return {
    element: panel,
    setLine(line: number | null) {
      const current = highlightedLine(listing, line);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (!item) continue;
        const on = index === current;
        item.classList.toggle("is-current", on);
        if (on) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      }
    },
  };
}

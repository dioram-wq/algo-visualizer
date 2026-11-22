import { gridBfsSteps, type GridBfsStep } from "./algorithms/grid-bfs.ts";
import {
  gridCellLabel,
  gridFrame,
  gridResultLabel,
  GRID_CELL_GAP,
  GRID_CELL_SIZE,
  type GridCellView,
  type GridFrame,
} from "./grid-layout.ts";
import { parseGrid } from "./parse-grid.ts";
import { createPlayback } from "./playback.ts";

export const DEFAULT_GRID = ["S.#.", "..#.", "...G"].join("\n");

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the grid breadth-first search player. The returned function stops its timer and key handling. */
export function mountGridBfs(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Grid breadth-first search";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    'Breadth-first search leaves the start and spreads one cell at a time, looking up, then right, then down, then left. A wall cannot be entered. The queue is the frontier, and a cell is visited when it leaves the queue. Reaching the goal colors a shortest path. Draw each row on its own line: "." is open, "#" is a wall, "S" is the start, and "G" is the goal. Use "@" when the start and the goal are the same cell.';

  const form = document.createElement("form");
  form.className = "controls";
  const gridLabel = area("Grid", "grid", DEFAULT_GRID);
  const gridInput = gridLabel.querySelector("textarea");
  if (!gridInput) throw new Error("Missing grid input");
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run";
  form.append(gridLabel, runButton);

  const error = document.createElement("p");
  error.className = "error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "Play";
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  const speedLabel = document.createElement("label");
  speedLabel.className = "speed";
  speedLabel.textContent = "Speed";
  const speedSelect = document.createElement("select");
  speedSelect.name = "speed";
  for (const option of PLAYBACK_SPEEDS) {
    const item = document.createElement("option");
    item.value = String(option.value);
    item.textContent = option.label;
    item.selected = option.value === 1;
    speedSelect.append(item);
  }
  speedLabel.append(speedSelect);
  const progress = document.createElement("p");
  progress.className = "progress";
  toolbar.append(previous, play, next, speedLabel, progress);

  const scene = document.createElement("div");
  scene.className = "grid-scene";
  const board = document.createElement("div");
  board.className = "grid-board";
  board.setAttribute("role", "grid");
  const result = document.createElement("p");
  result.className = "grid-result";
  scene.append(board, result);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("is-wall", "wall"),
    legendItem("is-frontier", "frontier"),
    legendItem("is-visited", "visited"),
    legendItem("is-current", "current"),
    legendItem("is-path", "path"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, legend, message);

  let steps: GridBfsStep[] = [];
  const playback = createPlayback();

  const showError = (text: string): void => {
    steps = [];
    playback.pause();
    playback.setLength(0);
    error.hidden = false;
    error.textContent = text;
    render();
  };

  const render = (): void => {
    const atEnd = playback.length === 0 || playback.index >= playback.length - 1;
    previous.disabled = playback.length === 0 || playback.index === 0;
    next.disabled = atEnd;
    play.disabled = !playback.playing && atEnd;
    play.textContent = playback.playing ? "Pause" : "Play";
    play.setAttribute("aria-pressed", playback.playing ? "true" : "false");
    speedSelect.disabled = playback.length === 0;

    const current = steps[playback.index];
    if (!current || playback.length === 0) {
      progress.textContent = "No steps";
      board.classList.remove("is-blocked");
      board.setAttribute("aria-label", "Breadth-first search grid");
      board.style.width = "";
      board.replaceChildren();
      result.textContent = "";
      result.classList.remove("is-blocked");
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const frame = gridFrame(current);
    board.classList.toggle("is-blocked", frame.blocked);
    board.setAttribute("aria-label", boardLabel(frame));
    board.style.gap = `${GRID_CELL_GAP}px`;
    board.style.width = `${frame.width}px`;
    board.replaceChildren(...renderRows(frame));
    result.classList.toggle("is-blocked", frame.blocked);
    result.textContent = gridResultLabel(current);
  };

  const run = (): void => {
    let nextSteps: GridBfsStep[];
    try {
      const parsed = parseGrid(gridInput.value);
      nextSteps = gridBfsSteps(parsed.grid, parsed.start, parsed.goal);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The grid search failed.");
      return;
    }
    playback.pause();
    steps = nextSteps;
    playback.setLength(nextSteps.length);
    playback.reset();
    // Length and index can both be unchanged, so render even when playback stays quiet.
    render();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run();
  });
  previous.addEventListener("click", () => {
    playback.previous();
  });
  play.addEventListener("click", () => {
    if (playback.playing) playback.pause();
    else playback.play();
  });
  next.addEventListener("click", () => {
    playback.next();
  });
  speedSelect.addEventListener("change", () => {
    playback.setSpeed(Number(speedSelect.value));
  });
  const unsubscribe = playback.subscribe(render);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      playback.previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      playback.next();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  run();

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    unsubscribe();
    playback.dispose();
  };
}

function area(labelText: string, name: string, value: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("textarea");
  input.name = name;
  input.value = value;
  input.rows = 4;
  input.wrap = "off";
  input.spellcheck = false;
  input.autocomplete = "off";
  label.append(input);
  return label;
}

function legendItem(kind: string, text: string): HTMLLIElement {
  const item = document.createElement("li");
  const swatch = document.createElement("span");
  swatch.className = `swatch ${kind}`;
  swatch.setAttribute("aria-hidden", "true");
  item.append(swatch, document.createTextNode(text));
  return item;
}

function boardLabel(frame: GridFrame): string {
  if (frame.blocked) return "Breadth-first search grid, no path";
  if (frame.reached) return "Breadth-first search grid, shortest path";
  return "Breadth-first search grid";
}

function renderRows(frame: GridFrame): HTMLElement[] {
  return frame.cells.map((line) => {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.setAttribute("role", "row");
    row.style.gap = `${GRID_CELL_GAP}px`;
    row.replaceChildren(...line.map((cell) => renderCell(cell)));
    return row;
  });
}

function renderCell(cell: GridCellView): HTMLElement {
  const element = document.createElement("div");
  element.className = `grid-cell is-${cell.shade}`;
  element.setAttribute("role", "gridcell");
  element.setAttribute("aria-label", gridCellLabel(cell));
  element.style.width = `${GRID_CELL_SIZE}px`;
  element.style.height = `${GRID_CELL_SIZE}px`;
  const mark = marker(cell);
  if (mark !== "") element.textContent = mark;
  return element;
}

function marker(cell: GridCellView): string {
  if (cell.start && cell.goal) return "@";
  if (cell.start) return "S";
  if (cell.goal) return "G";
  return "";
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

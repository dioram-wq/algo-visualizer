import { quickSortSteps, type QuickSortStep } from "./algorithms/quicksort.ts";
import { parseNumberList } from "./parse-numbers.ts";
import { createPlayback } from "./playback.ts";

const DEFAULT_ARRAY = "5, 2, 4, 6, 1, 3";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the quicksort player. The returned function stops its timer and key handling. */
export function mountQuickSort(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Quicksort";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "The last value in the active range is the pivot. Smaller or equal values swap toward the left, then the pivot takes its final place.";

  const form = document.createElement("form");
  form.className = "controls";
  const valuesLabel = field("Array", "values", DEFAULT_ARRAY);
  const valuesInput = valuesLabel.querySelector("input");
  if (!valuesInput) {
    throw new Error("Missing quicksort input");
  }
  valuesInput.spellcheck = false;
  valuesInput.autocomplete = "off";
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run";
  form.append(valuesLabel, runButton);

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

  const bars = document.createElement("div");
  bars.className = "bars";
  bars.setAttribute("role", "list");
  bars.setAttribute("aria-label", "Array bars");

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("is-range", "active range"),
    legendItem("is-pivot", "pivot"),
    legendItem("is-compare", "compared"),
    legendItem("is-swap", "swapped"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, bars, legend, message);

  let steps: QuickSortStep[] = [];
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
      bars.replaceChildren();
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const { min, max } = rangeOf(current.values);
    bars.replaceChildren(
      ...current.values.map((value, index) => renderBar(current, value, index, min, max)),
    );
  };

  const run = (): void => {
    let values: number[];
    try {
      values = parseNumberList(valuesInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: QuickSortStep[];
    try {
      nextSteps = quickSortSteps(values);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Quicksort failed.");
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

function field(labelText: string, name: string, value: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.name = name;
  input.type = "text";
  input.value = value;
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

function renderBar(
  step: QuickSortStep,
  value: number,
  index: number,
  min: number,
  max: number,
): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "listitem");
  if (step.low !== null && step.high !== null) {
    bar.classList.add(index >= step.low && index <= step.high ? "in-range" : "out-of-range");
  }
  if (index === step.pivot) bar.classList.add("is-pivot");
  if (step.action === "compare" && index === step.left) bar.classList.add("is-compare");
  if (step.action === "swap" && (index === step.left || index === step.right)) {
    bar.classList.add("is-swap");
  }

  const valueEl = document.createElement("span");
  valueEl.className = "value";
  valueEl.textContent = String(value);
  const column = document.createElement("span");
  column.className = "column";
  column.style.height = `${columnHeight(value, min, max)}px`;
  column.setAttribute("aria-hidden", "true");
  const indexEl = document.createElement("span");
  indexEl.className = "index";
  indexEl.textContent = String(index);
  bar.append(valueEl, column, indexEl);
  return bar;
}

function columnHeight(value: number, min: number, max: number): number {
  if (min === max) return 72;
  const ratio = (value - min) / (max - min);
  return Math.round(24 + ratio * 96);
}

function rangeOf(values: readonly number[]): { min: number; max: number } {
  let min = values[0] ?? 0;
  let max = min;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

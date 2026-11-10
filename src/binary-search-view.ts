import { binarySearchSteps, type BinarySearchStep } from "./algorithms/binary-search.ts";
import { parseFiniteNumber, parseNumberList } from "./parse-numbers.ts";
import { createPlayback } from "./playback.ts";

const DEFAULT_ARRAY = "2, 5, 8, 12, 16, 23, 38, 56, 72, 91";
const DEFAULT_TARGET = "23";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

export function mountBinarySearch(stage: HTMLElement): void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Binary search";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "The array stays sorted. Each step probes the midpoint of the remaining window.";

  const form = document.createElement("form");
  form.className = "controls";
  const valuesLabel = field("Sorted array", "values", DEFAULT_ARRAY, "text");
  const targetLabel = field("Target", "target", DEFAULT_TARGET, "text");
  const valuesInput = valuesLabel.querySelector("input");
  const targetInput = targetLabel.querySelector("input");
  if (!valuesInput || !targetInput) {
    throw new Error("Missing binary search inputs");
  }
  valuesInput.spellcheck = false;
  valuesInput.autocomplete = "off";
  targetInput.inputMode = "decimal";
  targetInput.autocomplete = "off";
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run";
  form.append(valuesLabel, targetLabel, runButton);

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

  const cells = document.createElement("div");
  cells.className = "cells";
  cells.setAttribute("role", "list");
  cells.setAttribute("aria-label", "Array cells");

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("in-range", "still in range"),
    legendItem("is-mid", "midpoint"),
    legendItem("is-found", "match"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, cells, legend, message);

  let steps: BinarySearchStep[] = [];
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

    const step = steps[playback.index];
    if (!step || playback.length === 0) {
      progress.textContent = "No steps";
      cells.replaceChildren();
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = step.message;
    cells.replaceChildren(
      ...step.values.map((value, cellIndex) => renderCell(step, value, cellIndex)),
    );
  };

  const run = (): void => {
    let values: number[];
    let target: number;
    try {
      values = parseNumberList(valuesInput.value);
      target = parseFiniteNumber(targetInput.value.trim());
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: BinarySearchStep[];
    try {
      nextSteps = binarySearchSteps(values, target);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Binary search failed.");
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
  playback.subscribe(render);
  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      playback.previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      playback.next();
    }
  });

  run();
}

function field(labelText: string, name: string, value: string, type: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
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

function renderCell(step: BinarySearchStep, value: number, cellIndex: number): HTMLDivElement {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.setAttribute("role", "listitem");
  const inRange = cellIndex >= step.low && cellIndex <= step.high;
  cell.classList.add(inRange ? "in-range" : "out-of-range");
  if (step.mid === cellIndex && step.foundIndex !== cellIndex) {
    cell.classList.add("is-mid");
  }
  if (step.foundIndex === cellIndex) {
    cell.classList.add("is-found");
  }
  const valueEl = document.createElement("span");
  valueEl.className = "value";
  valueEl.textContent = String(value);
  const indexEl = document.createElement("span");
  indexEl.className = "index";
  indexEl.textContent = String(cellIndex);
  cell.append(valueEl, indexEl);
  return cell;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

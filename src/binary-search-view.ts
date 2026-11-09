import { binarySearchSteps, type BinarySearchStep } from "./algorithms/binary-search.ts";
import { parseFiniteNumber, parseNumberList } from "./parse-numbers.ts";

const DEFAULT_ARRAY = "2, 5, 8, 12, 16, 23, 38, 56, 72, 91";
const DEFAULT_TARGET = "23";

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
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  const progress = document.createElement("p");
  progress.className = "progress";
  toolbar.append(previous, next, progress);

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
  let index = 0;

  const showError = (text: string): void => {
    steps = [];
    index = 0;
    error.hidden = false;
    error.textContent = text;
    cells.replaceChildren();
    message.textContent = "";
    progress.textContent = "No steps";
    previous.disabled = true;
    next.disabled = true;
  };

  const render = (): void => {
    const step = steps[index];
    if (!step) {
      showError("Nothing to show.");
      return;
    }
    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${index + 1} of ${steps.length}`;
    previous.disabled = index === 0;
    next.disabled = index === steps.length - 1;
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
    try {
      steps = binarySearchSteps(values, target);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Binary search failed.");
      return;
    }
    index = 0;
    render();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run();
  });
  previous.addEventListener("click", () => {
    if (index === 0) return;
    index -= 1;
    render();
  });
  next.addEventListener("click", () => {
    if (index >= steps.length - 1) return;
    index += 1;
    render();
  });
  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous.click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next.click();
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
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

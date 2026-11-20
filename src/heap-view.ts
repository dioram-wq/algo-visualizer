import { heapSteps, type HeapOperation, type HeapStep } from "./algorithms/heap.ts";
import {
  heapFrame,
  heapNodeLabel,
  heapResultLabel,
  HEAP_NODE_RADIUS,
  type HeapFrame,
  type HeapMark,
} from "./heap-layout.ts";
import { parseNumberList } from "./parse-numbers.ts";
import { parseHeapOperations } from "./parse-heap-ops.ts";
import { createPlayback } from "./playback.ts";

export const DEFAULT_HEAP_OPERATIONS =
  "insert 5, insert 3, insert 8, insert 1, extract-min, peek";

const DEFAULT_START = "";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the binary min-heap player. The returned function stops its timer and key handling. */
export function mountHeap(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Binary min-heap";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "A binary min-heap keeps the smallest value at the root. It is a complete tree stored in an array: index 0 is the root, and the children of index i are 2i + 1 and 2i + 2. Insert appends a value and sifts it up while it is smaller than its parent. Extract-min removes the root, moves the last value there, and sifts it down. Peek reads the root. Leave the start blank for an empty heap, or list values that are already a min-heap.";

  const form = document.createElement("form");
  form.className = "controls";
  const operationsLabel = field("Operations", "operations", DEFAULT_HEAP_OPERATIONS);
  const startLabel = field("Start, heap order", "start", DEFAULT_START);
  const operationsInput = operationsLabel.querySelector("input");
  const startInput = startLabel.querySelector("input");
  if (!operationsInput || !startInput) {
    throw new Error("Missing heap inputs");
  }
  operationsInput.spellcheck = false;
  operationsInput.autocomplete = "off";
  startInput.spellcheck = false;
  startInput.autocomplete = "off";
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run";
  form.append(operationsLabel, startLabel, runButton);

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
  scene.className = "heap-scene";
  const canvas = document.createElement("div");
  canvas.className = "heap-canvas";
  canvas.setAttribute("role", "tree");
  const result = document.createElement("p");
  result.className = "heap-result";
  scene.append(canvas, result);

  const arraySection = document.createElement("div");
  arraySection.className = "heap-array";
  const arrayCaption = document.createElement("p");
  arrayCaption.className = "heap-caption";
  arrayCaption.textContent = "array";
  const cells = document.createElement("div");
  cells.className = "cells";
  cells.setAttribute("role", "list");
  arraySection.append(arrayCaption, cells);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("is-compare", "compared"),
    legendItem("is-swap", "swapped"),
    legendItem("is-insert", "inserted"),
    legendItem("is-extract", "extracted"),
    legendItem("is-relocate", "moved"),
    legendItem("is-peek", "peeked"),
    legendItem("is-underflow", "underflow"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, arraySection, legend, message);

  let steps: HeapStep[] = [];
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
      canvas.classList.remove("is-underflow", "is-empty");
      canvas.setAttribute("aria-label", "Binary min-heap");
      canvas.style.width = "";
      canvas.style.height = "";
      canvas.replaceChildren();
      result.textContent = "";
      result.classList.remove("is-underflow");
      arraySection.classList.remove("is-underflow");
      arrayCaption.hidden = true;
      cells.setAttribute("aria-label", "Heap array");
      cells.replaceChildren();
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const frame = heapFrame(current);
    canvas.classList.toggle("is-underflow", frame.underflow);
    canvas.classList.toggle("is-empty", frame.empty);
    canvas.setAttribute("aria-label", treeLabel(frame.empty, frame.underflow));
    if (frame.empty) {
      canvas.style.width = "";
      canvas.style.height = "";
    } else {
      canvas.style.width = `${frame.width}px`;
      canvas.style.height = `${frame.height}px`;
    }
    canvas.replaceChildren(...renderFrame(frame));
    result.classList.toggle("is-underflow", frame.underflow);
    result.textContent = heapResultLabel(current);
    arraySection.classList.toggle("is-underflow", frame.underflow);
    arrayCaption.hidden = false;
    cells.setAttribute("aria-label", arrayLabel(frame.empty, frame.underflow));
    cells.replaceChildren(...renderCells(frame));
  };

  const run = (): void => {
    let initial: number[];
    let operations: HeapOperation[];
    try {
      initial = parseNumberList(startInput.value);
      operations = parseHeapOperations(operationsInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: HeapStep[];
    try {
      nextSteps = heapSteps(operations, initial);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The heap trace failed.");
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

function treeLabel(empty: boolean, underflow: boolean): string {
  if (empty && underflow) return "Empty heap, underflow";
  if (empty) return "Empty heap";
  return "Binary min-heap";
}

function arrayLabel(empty: boolean, underflow: boolean): string {
  if (empty && underflow) return "Empty heap array, underflow";
  if (empty) return "Empty heap array";
  return "Heap array";
}

function renderFrame(frame: HeapFrame): Node[] {
  if (frame.empty) {
    const empty = document.createElement("p");
    empty.className = "heap-empty";
    empty.textContent = frame.underflow ? "underflow" : "empty";
    return [empty];
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "heap-edges");
  svg.setAttribute("width", String(frame.width));
  svg.setAttribute("height", String(frame.height));
  svg.setAttribute("viewBox", `0 0 ${frame.width} ${frame.height}`);
  svg.setAttribute("aria-hidden", "true");
  for (const edge of frame.edges) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(edge.x1));
    line.setAttribute("y1", String(edge.y1));
    line.setAttribute("x2", String(edge.x2));
    line.setAttribute("y2", String(edge.y2));
    line.setAttribute("class", edge.marked ? "heap-edge is-marked" : "heap-edge");
    svg.append(line);
  }

  const nodes = frame.nodes.map((node) => {
    const element = document.createElement("div");
    const mark = markClass(node.mark);
    element.className = mark === "" ? "heap-node" : `heap-node ${mark}`;
    element.setAttribute("role", "treeitem");
    element.setAttribute("aria-label", heapNodeLabel(node.value, node.index, node.mark));
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    element.style.width = `${HEAP_NODE_RADIUS * 2}px`;
    element.style.height = `${HEAP_NODE_RADIUS * 2}px`;
    element.style.marginLeft = `${-HEAP_NODE_RADIUS}px`;
    element.style.marginTop = `${-HEAP_NODE_RADIUS}px`;
    element.textContent = String(node.value);
    return element;
  });

  return [svg, ...nodes];
}

function renderCells(frame: HeapFrame): HTMLElement[] {
  if (frame.empty) {
    const empty = document.createElement("p");
    empty.className = "heap-empty";
    empty.textContent = frame.underflow ? "underflow" : "empty";
    return [empty];
  }

  return frame.nodes.map((node) => {
    const cell = document.createElement("div");
    const mark = markClass(node.mark);
    cell.className = mark === "" ? "cell" : `cell ${mark}`;
    cell.setAttribute("role", "listitem");
    cell.setAttribute("aria-label", heapNodeLabel(node.value, node.index, node.mark));
    const valueEl = document.createElement("span");
    valueEl.className = "value";
    valueEl.textContent = String(node.value);
    const indexEl = document.createElement("span");
    indexEl.className = "index";
    indexEl.textContent = String(node.index);
    cell.append(valueEl, indexEl);
    return cell;
  });
}

function markClass(mark: HeapMark | null): string {
  switch (mark) {
    case null:
      return "";
    case "compare":
      return "is-compare";
    case "swap":
      return "is-swap";
    case "insert":
      return "is-insert";
    case "extract":
      return "is-extract";
    case "move":
      return "is-relocate";
    case "peek":
      return "is-peek";
    default: {
      const unexpected: never = mark;
      throw new Error(`Unexpected heap mark: ${String(unexpected)}`);
    }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

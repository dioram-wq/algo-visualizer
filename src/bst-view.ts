import { bstSteps, type BstOperation, type BstStep } from "./algorithms/bst.ts";
import {
  bstFrame,
  bstNodeLabel,
  bstResultLabel,
  BST_NODE_RADIUS,
  type BstFrame,
} from "./bst-layout.ts";
import { parseBstOperations } from "./parse-bst-ops.ts";
import { createPlayback } from "./playback.ts";

export const DEFAULT_BST_OPERATIONS =
  "insert 8, insert 3, insert 10, insert 1, insert 6, insert 14, insert 6, search 10, search 7";

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the binary search tree player. The returned function stops its timer and key handling. */
export function mountBst(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Binary search tree";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "A binary search tree sends a smaller value left and a larger value right. Insert adds a node when the next child is missing, and it leaves the tree unchanged when the value is already there. Search walks the same way and reports a hit or a miss.";

  const form = document.createElement("form");
  form.className = "controls";
  const operationsLabel = field("Operations", "operations", DEFAULT_BST_OPERATIONS);
  const operationsInput = operationsLabel.querySelector("input");
  if (!operationsInput) {
    throw new Error("Missing binary search tree input");
  }
  operationsInput.spellcheck = false;
  operationsInput.autocomplete = "off";
  const runButton = document.createElement("button");
  runButton.type = "submit";
  runButton.textContent = "Run";
  form.append(operationsLabel, runButton);

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
  scene.className = "bst-scene";
  const canvas = document.createElement("div");
  canvas.className = "bst-canvas";
  canvas.setAttribute("role", "tree");
  const result = document.createElement("p");
  result.className = "bst-result";
  scene.append(canvas, result);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("is-compare", "compared"),
    legendItem("is-move", "visited"),
    legendItem("is-insert", "inserted"),
    legendItem("is-duplicate", "duplicate"),
    legendItem("is-found", "found"),
    legendItem("is-missing", "missing"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, legend, message);

  let steps: BstStep[] = [];
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
      canvas.classList.remove("is-missing", "is-empty");
      canvas.setAttribute("aria-label", "Binary search tree");
      canvas.style.width = "";
      canvas.style.height = "";
      canvas.replaceChildren();
      result.textContent = "";
      result.classList.remove("is-missing");
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const frame = bstFrame(current);
    canvas.classList.toggle("is-missing", frame.missing);
    canvas.classList.toggle("is-empty", frame.empty);
    canvas.setAttribute("aria-label", treeLabel(frame.empty, frame.missing));
    if (frame.empty) {
      canvas.style.width = "";
      canvas.style.height = "";
    } else {
      canvas.style.width = `${frame.width}px`;
      canvas.style.height = `${frame.height}px`;
    }
    canvas.replaceChildren(...renderFrame(frame));
    result.classList.toggle("is-missing", frame.missing);
    result.textContent = bstResultLabel(current);
  };

  const run = (): void => {
    let operations: BstOperation[];
    try {
      operations = parseBstOperations(operationsInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: BstStep[];
    try {
      nextSteps = bstSteps(operations);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The binary search tree trace failed.");
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

function treeLabel(empty: boolean, missing: boolean): string {
  if (empty && missing) return "Empty tree, value not found";
  if (empty) return "Empty tree";
  if (missing) return "Binary search tree, value not found";
  return "Binary search tree";
}

function renderFrame(frame: BstFrame): Node[] {
  if (frame.empty) {
    const empty = document.createElement("p");
    empty.className = "bst-empty";
    empty.textContent = frame.missing ? "not found" : "empty";
    return [empty];
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "bst-edges");
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
    line.setAttribute("class", edge.marked ? "bst-edge is-marked" : "bst-edge");
    svg.append(line);
  }

  const nodes = frame.nodes.map((node) => {
    const element = document.createElement("div");
    element.className = node.mark === null ? "bst-node" : `bst-node is-${node.mark}`;
    element.setAttribute("role", "treeitem");
    element.setAttribute("aria-label", bstNodeLabel(node.value, node.mark));
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    element.style.width = `${BST_NODE_RADIUS * 2}px`;
    element.style.height = `${BST_NODE_RADIUS * 2}px`;
    element.style.marginLeft = `${-BST_NODE_RADIUS}px`;
    element.style.marginTop = `${-BST_NODE_RADIUS}px`;
    element.textContent = String(node.value);
    return element;
  });

  return [svg, ...nodes];
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

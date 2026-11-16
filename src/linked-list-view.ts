import {
  linkedListSteps,
  type LinkedListOperation,
  type LinkedListStep,
} from "./algorithms/linked-list.ts";
import { parseNumberList } from "./parse-numbers.ts";
import { parseLinkedListOperations } from "./parse-linked-list-ops.ts";
import { createPlayback } from "./playback.ts";

const DEFAULT_START = "";
const DEFAULT_OPERATIONS =
  "insert-head 4, insert-tail 9, insert-head 1, search 9, search 7, delete 1, delete 9, delete 4";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the linked list player. The returned function stops its timer and key handling. */
export function mountLinkedList(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Linked list";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "A linked list chains nodes from the head to the tail. Insert-head adds a value at the head, insert-tail adds one at the tail, search walks until it finds a value, and delete removes the first match. Leave the start blank for an empty list, or list values from head to tail. Search or delete of a missing value leaves the list unchanged.";

  const form = document.createElement("form");
  form.className = "controls";
  const operationsLabel = field("Operations", "operations", DEFAULT_OPERATIONS);
  const startLabel = field("Start, head to tail", "start", DEFAULT_START);
  const operationsInput = operationsLabel.querySelector("input");
  const startInput = startLabel.querySelector("input");
  if (!operationsInput || !startInput) {
    throw new Error("Missing linked list inputs");
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
  scene.className = "linked-list-scene";
  const line = document.createElement("div");
  line.className = "linked-list-line";
  const headCaption = document.createElement("p");
  headCaption.className = "linked-list-caption";
  headCaption.textContent = "head";
  const list = document.createElement("div");
  list.className = "linked-list";
  list.setAttribute("role", "list");
  line.append(headCaption, list);
  const result = document.createElement("p");
  result.className = "linked-list-result";
  scene.append(line, result);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(
    legendItem("is-head", "head"),
    legendItem("is-new", "inserted"),
    legendItem("is-match", "found"),
    legendItem("is-missing", "missing"),
  );

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, legend, message);

  let steps: LinkedListStep[] = [];
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
      list.classList.remove("is-missing", "is-empty");
      list.setAttribute("aria-label", "Linked list");
      list.replaceChildren();
      result.textContent = "";
      result.classList.remove("is-missing");
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const missing = current.action === "not-found";
    const empty = current.values.length === 0;
    list.classList.toggle("is-missing", missing);
    list.classList.toggle("is-empty", empty);
    list.setAttribute("aria-label", listLabel(empty, missing));
    list.replaceChildren(...renderNodes(current));
    result.classList.toggle("is-missing", missing);
    result.textContent = resultLabel(current);
  };

  const run = (): void => {
    let initial: number[];
    let operations: LinkedListOperation[];
    try {
      initial = parseNumberList(startInput.value);
      operations = parseLinkedListOperations(operationsInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: LinkedListStep[];
    try {
      nextSteps = linkedListSteps(operations, initial);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The linked list trace failed.");
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

function listLabel(empty: boolean, missing: boolean): string {
  if (empty && missing) return "Empty list, value not found";
  if (empty) return "Empty list";
  if (missing) return "Linked list, head to tail, value not found";
  return "Linked list, head to tail";
}

function renderNodes(current: LinkedListStep): HTMLElement[] {
  if (current.values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "linked-empty";
    empty.textContent = current.action === "not-found" ? "not found" : "empty";
    return [empty];
  }

  const nodes: HTMLElement[] = [];
  current.values.forEach((value, index) => {
    if (index > 0) nodes.push(arrow());
    const node = document.createElement("div");
    node.className = "linked-node";
    node.setAttribute("role", "listitem");
    if (index === 0) node.classList.add("is-head");
    if (
      (current.action === "insert-head" || current.action === "insert-tail") &&
      current.index === index
    ) {
      node.classList.add("is-new");
    }
    if (current.action === "search" && current.index === index) {
      node.classList.add("is-match");
    }
    node.textContent = String(value);
    nodes.push(node);
  });
  nodes.push(arrow());
  const terminator = document.createElement("span");
  terminator.className = "linked-null";
  terminator.setAttribute("aria-hidden", "true");
  terminator.textContent = "null";
  nodes.push(terminator);
  return nodes;
}

function arrow(): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "linked-arrow";
  span.setAttribute("aria-hidden", "true");
  span.textContent = "→";
  return span;
}

function resultLabel(current: LinkedListStep): string {
  switch (current.action) {
    case "start":
      return "";
    case "insert-head":
      return current.value === null ? "" : `inserted ${current.value} at the head`;
    case "insert-tail":
      return current.value === null ? "" : `inserted ${current.value} at the tail`;
    case "search":
      return current.value === null ? "" : `found ${current.value}`;
    case "delete":
      return current.value === null ? "" : `deleted ${current.value}`;
    case "not-found":
      return current.operation?.op === "search" ? "search missed" : "delete missed";
    default: {
      const unexpected: never = current.action;
      throw new Error(`Unexpected linked list action: ${String(unexpected)}`);
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

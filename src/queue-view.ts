import { queueSteps, type QueueOperation, type QueueStep } from "./algorithms/queue.ts";
import { parseNumberList } from "./parse-numbers.ts";
import { parseQueueOperations } from "./parse-queue-ops.ts";
import { createPlayback } from "./playback.ts";

const DEFAULT_START = "";
const DEFAULT_OPERATIONS = "enqueue 4, enqueue 9, peek, dequeue, enqueue 2, dequeue, dequeue";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the queue player. The returned function stops its timer and key handling. */
export function mountQueue(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Queue";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "A queue lines up from front to back. Enqueue adds a value at the back, peek reads the front, and dequeue removes it. Leave the start blank for an empty queue, or list values from front to back. Dequeue or peek on an empty queue is an underflow.";

  const form = document.createElement("form");
  form.className = "controls";
  const operationsLabel = field("Operations", "operations", DEFAULT_OPERATIONS);
  const startLabel = field("Start, front to back", "start", DEFAULT_START);
  const operationsInput = operationsLabel.querySelector("input");
  const startInput = startLabel.querySelector("input");
  if (!operationsInput || !startInput) {
    throw new Error("Missing queue inputs");
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
  scene.className = "queue-scene";
  const line = document.createElement("div");
  line.className = "queue-line";
  const frontCaption = document.createElement("p");
  frontCaption.className = "queue-caption";
  frontCaption.textContent = "front";
  const queue = document.createElement("div");
  queue.className = "queue";
  queue.setAttribute("role", "list");
  const backCaption = document.createElement("p");
  backCaption.className = "queue-caption";
  backCaption.textContent = "back";
  line.append(frontCaption, queue, backCaption);
  const result = document.createElement("p");
  result.className = "queue-result";
  scene.append(line, result);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(legendItem("is-front", "front"), legendItem("is-underflow", "underflow"));

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, legend, message);

  let steps: QueueStep[] = [];
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
      queue.classList.remove("is-underflow", "is-empty");
      queue.setAttribute("aria-label", "Queue");
      queue.replaceChildren();
      result.textContent = "";
      result.classList.remove("is-underflow");
      message.textContent = "";
      return;
    }

    error.hidden = true;
    error.textContent = "";
    progress.textContent = `Step ${playback.index + 1} of ${playback.length}`;
    message.textContent = current.message;
    const underflow = current.action === "underflow";
    const empty = current.values.length === 0;
    queue.classList.toggle("is-underflow", underflow);
    queue.classList.toggle("is-empty", empty);
    queue.setAttribute(
      "aria-label",
      empty ? (underflow ? "Empty queue, underflow" : "Empty queue") : "Queue, front to back",
    );
    queue.replaceChildren(...renderCells(current));
    result.classList.toggle("is-underflow", underflow);
    result.textContent = resultLabel(current);
  };

  const run = (): void => {
    let initial: number[];
    let operations: QueueOperation[];
    try {
      initial = parseNumberList(startInput.value);
      operations = parseQueueOperations(operationsInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: QueueStep[];
    try {
      nextSteps = queueSteps(operations, initial);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The queue trace failed.");
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

function renderCells(current: QueueStep): HTMLElement[] {
  if (current.values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "queue-empty";
    empty.textContent = current.action === "underflow" ? "underflow" : "empty";
    return [empty];
  }

  return current.values.map((value, index) => {
    const cell = document.createElement("div");
    cell.className = "queue-cell";
    cell.setAttribute("role", "listitem");
    if (index === 0) cell.classList.add("is-front");
    cell.textContent = String(value);
    return cell;
  });
}

function resultLabel(current: QueueStep): string {
  switch (current.action) {
    case "start":
      return "";
    case "enqueue":
      return current.value === null ? "" : `enqueued ${current.value}`;
    case "dequeue":
      return current.value === null ? "" : `dequeued ${current.value}`;
    case "peek":
      return current.value === null ? "" : `peeked ${current.value}`;
    case "underflow":
      return current.operation?.op === "peek" ? "peek underflow" : "dequeue underflow";
    default: {
      const unexpected: never = current.action;
      throw new Error(`Unexpected queue action: ${String(unexpected)}`);
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

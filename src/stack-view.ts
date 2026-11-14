import { stackSteps, type StackOperation, type StackStep } from "./algorithms/stack.ts";
import { parseNumberList } from "./parse-numbers.ts";
import { parseStackOperations } from "./parse-stack-ops.ts";
import { createPlayback } from "./playback.ts";

const DEFAULT_START = "";
const DEFAULT_OPERATIONS = "push 4, push 9, peek, pop, push 2, pop, pop";
const PLAYBACK_SPEEDS = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
] as const;

/** Mount the stack player. The returned function stops its timer and key handling. */
export function mountStack(stage: HTMLElement): () => void {
  stage.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = "Stack";
  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "A stack grows upward. Push puts a value on top, peek reads it, and pop removes it. Leave the start blank for an empty stack, or list values from bottom to top. Pop or peek on an empty stack is an underflow.";

  const form = document.createElement("form");
  form.className = "controls";
  const operationsLabel = field("Operations", "operations", DEFAULT_OPERATIONS);
  const startLabel = field("Start, bottom to top", "start", DEFAULT_START);
  const operationsInput = operationsLabel.querySelector("input");
  const startInput = startLabel.querySelector("input");
  if (!operationsInput || !startInput) {
    throw new Error("Missing stack inputs");
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
  scene.className = "stack-scene";
  const topCaption = document.createElement("p");
  topCaption.className = "stack-caption";
  topCaption.textContent = "top";
  const stack = document.createElement("div");
  stack.className = "stack";
  stack.setAttribute("role", "list");
  const bottomCaption = document.createElement("p");
  bottomCaption.className = "stack-caption";
  bottomCaption.textContent = "bottom";
  const result = document.createElement("p");
  result.className = "stack-result";
  scene.append(topCaption, stack, bottomCaption, result);

  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.append(legendItem("is-top", "top"), legendItem("is-underflow", "underflow"));

  const message = document.createElement("p");
  message.className = "message";
  message.setAttribute("aria-live", "polite");

  stage.append(heading, intro, form, error, toolbar, scene, legend, message);

  let steps: StackStep[] = [];
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
      stack.classList.remove("is-underflow", "is-empty");
      stack.setAttribute("aria-label", "Stack");
      stack.replaceChildren();
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
    stack.classList.toggle("is-underflow", underflow);
    stack.classList.toggle("is-empty", empty);
    stack.setAttribute(
      "aria-label",
      empty ? (underflow ? "Empty stack, underflow" : "Empty stack") : "Stack, top to bottom",
    );
    stack.replaceChildren(...renderPlates(current));
    result.classList.toggle("is-underflow", underflow);
    result.textContent = resultLabel(current);
  };

  const run = (): void => {
    let initial: number[];
    let operations: StackOperation[];
    try {
      initial = parseNumberList(startInput.value);
      operations = parseStackOperations(operationsInput.value);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Could not read the input.");
      return;
    }
    let nextSteps: StackStep[];
    try {
      nextSteps = stackSteps(operations, initial);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The stack trace failed.");
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

function renderPlates(current: StackStep): HTMLElement[] {
  if (current.values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "stack-empty";
    empty.textContent = current.action === "underflow" ? "underflow" : "empty";
    return [empty];
  }

  const plates: HTMLDivElement[] = [];
  const topIndex = current.values.length - 1;
  for (let index = topIndex; index >= 0; index -= 1) {
    const plate = document.createElement("div");
    plate.className = "stack-plate";
    plate.setAttribute("role", "listitem");
    if (index === topIndex) plate.classList.add("is-top");
    const value = current.values[index];
    plate.textContent = value === undefined ? "" : String(value);
    plates.push(plate);
  }
  return plates;
}

function resultLabel(current: StackStep): string {
  switch (current.action) {
    case "start":
      return "";
    case "push":
      return current.value === null ? "" : `pushed ${current.value}`;
    case "pop":
      return current.value === null ? "" : `popped ${current.value}`;
    case "peek":
      return current.value === null ? "" : `peeked ${current.value}`;
    case "underflow":
      return current.operation?.op === "peek" ? "peek underflow" : "pop underflow";
    default: {
      const unexpected: never = current.action;
      throw new Error(`Unexpected stack action: ${String(unexpected)}`);
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

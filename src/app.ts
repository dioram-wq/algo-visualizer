import { mountBinarySearch } from "./binary-search-view.ts";
import { mountInsertionSort } from "./insertion-sort-view.ts";
import { mountMergeSort } from "./merge-sort-view.ts";
import { mountQuickSort } from "./quicksort-view.ts";
import { mountStack } from "./stack-view.ts";

type AlgorithmId = "binary-search" | "insertion-sort" | "merge-sort" | "quicksort" | "stack";

const ALGORITHMS: readonly { id: AlgorithmId; label: string }[] = [
  { id: "binary-search", label: "Binary search" },
  { id: "insertion-sort", label: "Insertion sort" },
  { id: "merge-sort", label: "Merge sort" },
  { id: "quicksort", label: "Quicksort" },
  { id: "stack", label: "Stack" },
];

export function mountApp(root: HTMLElement): void {
  root.replaceChildren();

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <p class="kicker">CS courses</p>
    <h1>Algo Visualizer</h1>
    <p class="lede">
      Watch an algorithm make one decision at a time. Step generators stay
      pure so each course topic can be tested without the page.
    </p>
  `;

  const switcher = document.createElement("nav");
  switcher.className = "switcher";
  switcher.setAttribute("aria-label", "Algorithm");

  const stage = document.createElement("section");
  stage.className = "stage";
  stage.id = "stage";
  stage.setAttribute("aria-label", "Visualization");

  const buttons = new Map<AlgorithmId, HTMLButtonElement>();
  let selected: AlgorithmId | null = null;
  let unmount = (): void => {};

  const select = (id: AlgorithmId): void => {
    if (id === selected) return;
    unmount();
    unmount = mountAlgorithm(stage, id);
    selected = id;
    for (const [key, button] of buttons) {
      button.setAttribute("aria-pressed", key === id ? "true" : "false");
    }
  };

  for (const algorithm of ALGORITHMS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = algorithm.label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      select(algorithm.id);
    });
    buttons.set(algorithm.id, button);
    switcher.append(button);
  }

  root.append(header, switcher, stage);
  select("binary-search");
}

function mountAlgorithm(stage: HTMLElement, id: AlgorithmId): () => void {
  switch (id) {
    case "binary-search":
      return mountBinarySearch(stage);
    case "insertion-sort":
      return mountInsertionSort(stage);
    case "merge-sort":
      return mountMergeSort(stage);
    case "quicksort":
      return mountQuickSort(stage);
    case "stack":
      return mountStack(stage);
    default: {
      const unexpected: never = id;
      throw new Error(`Unexpected algorithm: ${String(unexpected)}`);
    }
  }
}

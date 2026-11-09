import { mountBinarySearch } from "./binary-search-view.ts";

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

  const stage = document.createElement("section");
  stage.className = "stage";
  stage.id = "stage";
  stage.setAttribute("aria-label", "Visualization");

  root.append(header, stage);
  mountBinarySearch(stage);
}

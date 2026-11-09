# algo-visualizer

Interactive visualizer for the algorithms and data structures taught in undergraduate CS courses. Each algorithm is a pure step generator, covered by Vitest, and the page only plays those steps.

## Setup

```bash
npm install
npm run dev    # http://127.0.0.1:5173
npm test
npm run build
```

## What's here

- Vite + TypeScript app shell
- Binary search step generator (`src/algorithms/binary-search.ts`)
- A player for one sorted array: previous and next, or the left and right arrow keys

The generator assumes a non-decreasing array of finite numbers. It records the opening window, every midpoint probe, and either the matching index or an empty window.

## Roadmap

1. Shared playback controls: play, pause, and speed, reused by every algorithm
2. Sorting: insertion sort, merge sort, and quicksort
3. Linear structures: stack, queue, and linked list
4. Trees: binary search tree insert and search, then heap operations
5. Graphs: BFS and DFS on a small grid
6. A code panel that highlights the line for the current step
7. Course checks that ask you to predict the next step

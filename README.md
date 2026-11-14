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
- Insertion sort step generator (`src/algorithms/insertion-sort.ts`)
- Merge sort step generator (`src/algorithms/merge-sort.ts`)
- Quicksort step generator (`src/algorithms/quicksort.ts`)
- Stack step generator (`src/algorithms/stack.ts`)
- A player that switches between binary search, insertion sort, merge sort, quicksort, and stack, using shared playback controls (`src/playback.ts`): play, pause, speed, previous, and next. The left and right arrow keys step too.

The binary search generator assumes a non-decreasing array of finite numbers. It records the opening window, every midpoint probe, and either the matching index or an empty window.

The insertion sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every comparison, every adjacent swap, and the sorted-prefix boundary, and it ends on the sorted array.

The merge sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every split of a subarray, every comparison while two sorted halves are merged, and every write back into the array, and it ends on the sorted array.

The quicksort generator takes any array of finite numbers and does not mutate it. It uses Lomuto partition, with the last element of the active range as the pivot. It records the starting array, the active subarray range, each pivot choice, every comparison, every swap, and the pivot's final position, and it ends on the sorted array.

The stack generator takes a list of push, pop, and peek operations and an optional starting stack, and does not mutate either. It records the starting stack, each operation, the pushed, popped, or peeked value, an underflow when pop or peek hits an empty stack, and the stack contents after each operation.

## How it's built

This project is built with AI pair programming (Cursor agents) under Diogo's direction. Changes land in small increments.

## Roadmap

1. Shared playback controls: play, pause, and speed, reused by every algorithm. **Done.** The controller is `src/playback.ts`. Binary search, insertion sort, merge sort, quicksort, and stack use it, and later algorithms should too.
2. Sorting: insertion sort, merge sort, and quicksort. **Done.** The generators are `src/algorithms/insertion-sort.ts`, `src/algorithms/merge-sort.ts`, and `src/algorithms/quicksort.ts`, and the page plays them with the shared controls.
3. Linear structures: stack, queue, and linked list. **In progress.** The stack generator is `src/algorithms/stack.ts`, and the page plays it with the shared controls. Queue and linked list are next.
4. Trees: binary search tree insert and search, then heap operations
5. Graphs: BFS and DFS on a small grid
6. A code panel that highlights the line for the current step
7. Course checks that ask you to predict the next step

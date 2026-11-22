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
- Queue step generator (`src/algorithms/queue.ts`)
- Linked list step generator (`src/algorithms/linked-list.ts`)
- Binary search tree step generator (`src/algorithms/bst.ts`)
- Binary min-heap step generator (`src/algorithms/heap.ts`)
- Grid breadth-first search step generator (`src/algorithms/grid-bfs.ts`). The page does not play it yet.
- A player that switches between binary search, insertion sort, merge sort, quicksort, stack, queue, linked list, binary search tree, and binary min-heap, using shared playback controls (`src/playback.ts`): play, pause, speed, previous, and next. The left and right arrow keys step too.

The binary search generator assumes a non-decreasing array of finite numbers. It records the opening window, every midpoint probe, and either the matching index or an empty window.

The insertion sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every comparison, every adjacent swap, and the sorted-prefix boundary, and it ends on the sorted array.

The merge sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every split of a subarray, every comparison while two sorted halves are merged, and every write back into the array, and it ends on the sorted array.

The quicksort generator takes any array of finite numbers and does not mutate it. It uses Lomuto partition, with the last element of the active range as the pivot. It records the starting array, the active subarray range, each pivot choice, every comparison, every swap, and the pivot's final position, and it ends on the sorted array.

The stack generator takes a list of push, pop, and peek operations and an optional starting stack, and does not mutate either. It records the starting stack, each operation, the pushed, popped, or peeked value, an underflow when pop or peek hits an empty stack, and the stack contents after each operation.

The queue generator takes a list of enqueue, dequeue, and peek operations and an optional starting queue, and does not mutate either. It records the starting queue, each operation, the enqueued, dequeued, or peeked value, an underflow when dequeue or peek hits an empty queue, and the queue contents (front to back) after each operation.

The linked list generator takes a list of insert-head, insert-tail, search, and delete operations and an optional starting list, and does not mutate either. It records the starting list, each operation, the inserted, found, or deleted value and its index, a miss when search or delete does not find the value, and the list contents (head to tail) after each operation. Search and delete use the first match.

The binary search tree generator takes a list of insert and search operations and does not mutate it. It records the empty tree, every comparison, every move to an existing left or right child, each inserted node, a duplicate when an insert meets a value already in the tree, and found or not-found for a search. Duplicates are not inserted: an equal value stops the walk and the tree stays as it was, so the shape depends on the first time each value is inserted.

The binary min-heap generator takes a list of insert, extract-min, and peek operations and an optional starting heap, and does not mutate either. It records the starting heap, each operation, sift-up comparisons and swaps on insert, root removal, the move of the last value to the root, and sift-down comparisons and swaps on extract-min, an underflow when extract-min or peek hits an empty heap, and the heap array after each operation. The starting array must already be a min-heap, stored with the parent before its children. Equal values do not swap.

The grid breadth-first search generator takes a small rectangular grid of open cells and walls, a start cell, and a goal cell, and does not mutate them. It searches four ways from each cell: up, then right, then down, then left. It records each enqueue, each visit when a cell is dequeued, the frontier from front to back, and the visited cells in the order they were dequeued. A cell joins the frontier once, and it is not enqueued again. When the goal is dequeued, it records a shortest path from the start to the goal. If the frontier empties first, it records that there is no path. The start and the goal must be open cells on the grid.

## How it's built

This project is built with AI pair programming (Cursor agents) under Diogo's direction. Changes land in small increments.

## Roadmap

1. Shared playback controls: play, pause, and speed, reused by every algorithm. **Done.** The controller is `src/playback.ts`. Binary search, insertion sort, merge sort, quicksort, stack, queue, linked list, binary search tree, and binary min-heap use it, and later algorithms should too.
2. Sorting: insertion sort, merge sort, and quicksort. **Done.** The generators are `src/algorithms/insertion-sort.ts`, `src/algorithms/merge-sort.ts`, and `src/algorithms/quicksort.ts`, and the page plays them with the shared controls.
3. Linear structures: stack, queue, and linked list. **Done.** The generators are `src/algorithms/stack.ts`, `src/algorithms/queue.ts`, and `src/algorithms/linked-list.ts`, and the page plays them with the shared controls.
4. Trees: binary search tree insert and search, then heap operations. **Done.** The generators are `src/algorithms/bst.ts` and `src/algorithms/heap.ts`, and the page plays both with the shared controls.
5. Graphs: BFS and DFS on a small grid. The BFS generator is **done** (`src/algorithms/grid-bfs.ts`). **Next** is a grid view that plays those steps, then DFS.
6. A code panel that highlights the line for the current step
7. Course checks that ask you to predict the next step

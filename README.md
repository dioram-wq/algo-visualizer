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
- A player that switches between binary search, insertion sort, merge sort, quicksort, stack, queue, linked list, and binary search tree, using shared playback controls (`src/playback.ts`): play, pause, speed, previous, and next. The left and right arrow keys step too.

The binary search generator assumes a non-decreasing array of finite numbers. It records the opening window, every midpoint probe, and either the matching index or an empty window.

The insertion sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every comparison, every adjacent swap, and the sorted-prefix boundary, and it ends on the sorted array.

The merge sort generator takes any array of finite numbers and does not mutate it. It records the starting array, every split of a subarray, every comparison while two sorted halves are merged, and every write back into the array, and it ends on the sorted array.

The quicksort generator takes any array of finite numbers and does not mutate it. It uses Lomuto partition, with the last element of the active range as the pivot. It records the starting array, the active subarray range, each pivot choice, every comparison, every swap, and the pivot's final position, and it ends on the sorted array.

The stack generator takes a list of push, pop, and peek operations and an optional starting stack, and does not mutate either. It records the starting stack, each operation, the pushed, popped, or peeked value, an underflow when pop or peek hits an empty stack, and the stack contents after each operation.

The queue generator takes a list of enqueue, dequeue, and peek operations and an optional starting queue, and does not mutate either. It records the starting queue, each operation, the enqueued, dequeued, or peeked value, an underflow when dequeue or peek hits an empty queue, and the queue contents (front to back) after each operation.

The linked list generator takes a list of insert-head, insert-tail, search, and delete operations and an optional starting list, and does not mutate either. It records the starting list, each operation, the inserted, found, or deleted value and its index, a miss when search or delete does not find the value, and the list contents (head to tail) after each operation. Search and delete use the first match.

The binary search tree generator takes a list of insert and search operations and does not mutate it. It records the empty tree, every comparison, every move to an existing left or right child, each inserted node, a duplicate when an insert meets a value already in the tree, and found or not-found for a search. Duplicates are not inserted: an equal value stops the walk and the tree stays as it was, so the shape depends on the first time each value is inserted.

## How it's built

This project is built with AI pair programming (Cursor agents) under Diogo's direction. Changes land in small increments.

## Roadmap

1. Shared playback controls: play, pause, and speed, reused by every algorithm. **Done.** The controller is `src/playback.ts`. Binary search, insertion sort, merge sort, quicksort, stack, queue, linked list, and binary search tree use it, and later algorithms should too.
2. Sorting: insertion sort, merge sort, and quicksort. **Done.** The generators are `src/algorithms/insertion-sort.ts`, `src/algorithms/merge-sort.ts`, and `src/algorithms/quicksort.ts`, and the page plays them with the shared controls.
3. Linear structures: stack, queue, and linked list. **Done.** The generators are `src/algorithms/stack.ts`, `src/algorithms/queue.ts`, and `src/algorithms/linked-list.ts`, and the page plays them with the shared controls.
4. Trees: binary search tree insert and search, then heap operations. The BST view is **done**. The generator is `src/algorithms/bst.ts`, and the page plays it with the shared controls. **Next** is heap operations.
5. Graphs: BFS and DFS on a small grid
6. A code panel that highlights the line for the current step
7. Course checks that ask you to predict the next step

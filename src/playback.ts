/**
 * Playback over a numbered list of steps.
 * The controller does not know what a step contains: callers keep the list
 * and read `index`. Play and pause schedule through an injected clock so the
 * timing can be tested without waiting on real time.
 */

export const DEFAULT_PLAYBACK_STEP_MS = 1000;
export const DEFAULT_PLAYBACK_SPEED = 1;

export interface PlaybackClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CreatePlaybackOptions {
  length?: number;
  /** Steps per second, relative to `stepMs`. 1 waits `stepMs` between steps. */
  speed?: number;
  /** Delay between steps at speed 1, in milliseconds. */
  stepMs?: number;
  clock?: PlaybackClock;
}

export interface PlaybackController {
  readonly index: number;
  readonly length: number;
  readonly playing: boolean;
  readonly speed: number;
  next(): void;
  previous(): void;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
  setLength(length: number): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

interface PlaybackState {
  readonly index: number;
  readonly length: number;
  readonly playing: boolean;
  readonly speed: number;
}

type PlaybackCommand =
  | { type: "next" }
  | { type: "previous" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "tick" }
  | { type: "reset" }
  | { type: "set-length"; length: number }
  | { type: "set-speed"; speed: number };

const systemClock: PlaybackClock = {
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

export function createPlayback(options: CreatePlaybackOptions = {}): PlaybackController {
  const stepMs = options.stepMs ?? DEFAULT_PLAYBACK_STEP_MS;
  assertStepMs(stepMs);
  const clock = options.clock ?? systemClock;
  let state: PlaybackState = {
    index: 0,
    length: 0,
    playing: false,
    speed: DEFAULT_PLAYBACK_SPEED,
  };
  state = reduce(state, { type: "set-speed", speed: options.speed ?? DEFAULT_PLAYBACK_SPEED });
  if (options.length !== undefined) {
    state = reduce(state, { type: "set-length", length: options.length });
  }

  let timer: unknown = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const clearTimer = (): void => {
    if (timer === null) return;
    clock.clearTimeout(timer);
    timer = null;
  };

  const schedule = (): void => {
    clearTimer();
    const delayMs = stepMs / state.speed;
    timer = clock.setTimeout(() => {
      timer = null;
      if (disposed) return;
      dispatch({ type: "tick" });
    }, delayMs);
  };

  const syncTimer = (previous: PlaybackState): void => {
    if (!state.playing) {
      clearTimer();
      return;
    }
    const moved = previous.index !== state.index;
    const speedChanged = previous.speed !== state.speed;
    if (!previous.playing || moved || speedChanged || timer === null) {
      schedule();
    }
  };

  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const dispatch = (command: PlaybackCommand): void => {
    if (disposed) {
      throw new Error("Playback controller is disposed.");
    }
    const next = reduce(state, command);
    if (next === state) return;
    const previous = state;
    state = next;
    syncTimer(previous);
    emit();
  };

  return {
    get index() {
      return state.index;
    },
    get length() {
      return state.length;
    },
    get playing() {
      return state.playing;
    },
    get speed() {
      return state.speed;
    },
    next() {
      dispatch({ type: "next" });
    },
    previous() {
      dispatch({ type: "previous" });
    },
    play() {
      dispatch({ type: "play" });
    },
    pause() {
      dispatch({ type: "pause" });
    },
    setSpeed(speed: number) {
      dispatch({ type: "set-speed", speed });
    },
    setLength(length: number) {
      dispatch({ type: "set-length", length });
    },
    reset() {
      dispatch({ type: "reset" });
    },
    subscribe(listener: () => void) {
      if (disposed) {
        throw new Error("Playback controller is disposed.");
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      state = { ...state, playing: false };
      listeners.clear();
    },
  };
}

function reduce(state: PlaybackState, command: PlaybackCommand): PlaybackState {
  switch (command.type) {
    case "next": {
      if (state.length === 0 || state.index >= state.length - 1) return state;
      const index = state.index + 1;
      return {
        ...state,
        index,
        playing: state.playing && index < state.length - 1,
      };
    }
    case "previous": {
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };
    }
    case "play": {
      if (state.playing || state.length < 2 || state.index >= state.length - 1) return state;
      return { ...state, playing: true };
    }
    case "pause": {
      if (!state.playing) return state;
      return { ...state, playing: false };
    }
    case "tick": {
      if (!state.playing) return state;
      if (state.index >= state.length - 1) return { ...state, playing: false };
      const index = state.index + 1;
      return {
        ...state,
        index,
        playing: index < state.length - 1,
      };
    }
    case "reset": {
      if (!state.playing && state.index === 0) return state;
      return { ...state, index: 0, playing: false };
    }
    case "set-length": {
      assertLength(command.length);
      const index = command.length === 0 ? 0 : Math.min(state.index, command.length - 1);
      const playing = state.playing && command.length > 1 && index < command.length - 1;
      if (command.length === state.length && index === state.index && playing === state.playing) {
        return state;
      }
      return { ...state, length: command.length, index, playing };
    }
    case "set-speed": {
      assertSpeed(command.speed);
      if (command.speed === state.speed) return state;
      return { ...state, speed: command.speed };
    }
    default: {
      const unexpected: never = command;
      throw new Error(`Unexpected playback command: ${String(unexpected)}`);
    }
  }
}

function assertLength(length: number): void {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("Playback length must be a non-negative integer.");
  }
}

function assertSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError("Playback speed must be a finite number greater than 0.");
  }
}

function assertStepMs(stepMs: number): void {
  if (!Number.isFinite(stepMs) || stepMs <= 0) {
    throw new RangeError("Playback stepMs must be a finite number greater than 0.");
  }
}

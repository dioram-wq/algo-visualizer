import { describe, expect, it } from "vitest";
import {
  createPlayback,
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_PLAYBACK_STEP_MS,
  type PlaybackClock,
} from "./playback.ts";

describe("createPlayback", () => {
  it("clamps next and previous at the ends", () => {
    const playback = createPlayback({ length: 3 });
    expect(playback.index).toBe(0);
    expect(playback.playing).toBe(false);

    playback.previous();
    expect(playback.index).toBe(0);

    playback.next();
    playback.next();
    playback.next();
    expect(playback.index).toBe(2);

    playback.next();
    expect(playback.index).toBe(2);
  });

  it("refuses to play an empty list or a single step", () => {
    const emptyClock = createManualClock();
    const empty = createPlayback({ length: 0, clock: emptyClock.clock });
    empty.next();
    empty.previous();
    empty.play();
    expect(empty.index).toBe(0);
    expect(empty.playing).toBe(false);
    expect(emptyClock.pending()).toEqual([]);

    const singleClock = createManualClock();
    const single = createPlayback({ length: 1, clock: singleClock.clock });
    single.play();
    single.next();
    expect(single.index).toBe(0);
    expect(single.playing).toBe(false);
    expect(singleClock.pending()).toEqual([]);
  });

  it("plays on the injected clock until the last step, then pauses", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 3, stepMs: 1000, clock: manual.clock });
    const seen: number[] = [];
    playback.subscribe(() => {
      seen.push(playback.index);
    });

    playback.play();
    expect(playback.playing).toBe(true);
    expect(manual.pending()).toEqual([{ id: 1, delayMs: 1000 }]);
    expect(seen).toEqual([0]);

    manual.fireNext();
    expect(playback.index).toBe(1);
    expect(playback.playing).toBe(true);
    expect(manual.pending().map((entry) => entry.delayMs)).toEqual([1000]);

    manual.fireNext();
    expect(playback.index).toBe(2);
    expect(playback.playing).toBe(false);
    expect(manual.pending()).toEqual([]);
    expect(seen).toEqual([0, 1, 2]);

    playback.play();
    expect(playback.playing).toBe(false);
    expect(manual.pending()).toEqual([]);
  });

  it("pauses by cancelling the pending step", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 4, stepMs: 500, clock: manual.clock });
    playback.play();
    expect(manual.pending()).toHaveLength(1);

    playback.pause();
    expect(playback.playing).toBe(false);
    expect(playback.index).toBe(0);
    expect(manual.pending()).toEqual([]);

    playback.pause();
    expect(playback.playing).toBe(false);
  });

  it("ignores a tick that still fires after pause", () => {
    let stored: (() => void) | undefined;
    const clock: PlaybackClock = {
      setTimeout(callback) {
        stored = callback;
        return 1;
      },
      clearTimeout() {
        // Leave the callback reachable so the test can deliver a late tick.
      },
    };
    const playback = createPlayback({ length: 4, stepMs: 100, clock });
    playback.play();
    playback.pause();
    stored?.();
    expect(playback.index).toBe(0);
    expect(playback.playing).toBe(false);
  });

  it("schedules one timer and replaces it when play is already running", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 4, stepMs: 1000, clock: manual.clock });
    playback.play();
    playback.play();
    expect(manual.pending()).toHaveLength(1);
    expect(playback.playing).toBe(true);
  });

  it("treats speed as a multiplier of the step delay", () => {
    const manual = createManualClock();
    const playback = createPlayback({
      length: 5,
      stepMs: 1000,
      speed: 2,
      clock: manual.clock,
    });
    expect(playback.speed).toBe(2);

    playback.play();
    expect(manual.pending()[0]?.delayMs).toBe(500);

    playback.setSpeed(0.5);
    expect(playback.speed).toBe(0.5);
    expect(manual.pending()).toHaveLength(1);
    expect(manual.pending()[0]?.delayMs).toBe(2000);

    playback.pause();
    playback.setSpeed(4);
    expect(manual.pending()).toEqual([]);
    playback.play();
    expect(manual.pending()[0]?.delayMs).toBe(250);
  });

  it("steps manually during playback and stops on the last step", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 3, stepMs: 800, clock: manual.clock });
    playback.next();
    playback.play();
    const firstId = manual.pending()[0]?.id;

    playback.previous();
    expect(playback.index).toBe(0);
    expect(playback.playing).toBe(true);
    expect(manual.pending()).toHaveLength(1);
    expect(manual.pending()[0]?.id).not.toBe(firstId);
    expect(manual.pending()[0]?.delayMs).toBe(800);

    manual.fireNext();
    expect(playback.index).toBe(1);
    playback.next();
    expect(playback.index).toBe(2);
    expect(playback.playing).toBe(false);
    expect(manual.pending()).toEqual([]);
  });

  it("clamps the index when the length changes and does not resume on its own", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 6, stepMs: 100, clock: manual.clock });
    playback.next();
    playback.next();
    playback.next();
    playback.play();
    const runningId = manual.pending()[0]?.id;

    playback.setLength(8);
    expect(playback.index).toBe(3);
    expect(playback.playing).toBe(true);
    expect(manual.pending()[0]?.id).toBe(runningId);

    playback.setLength(4);
    expect(playback.index).toBe(3);
    expect(playback.playing).toBe(false);
    expect(manual.pending()).toEqual([]);

    playback.setLength(2);
    expect(playback.index).toBe(1);
    expect(playback.playing).toBe(false);

    playback.setLength(0);
    expect(playback.index).toBe(0);
    expect(playback.length).toBe(0);

    playback.setLength(5);
    playback.next();
    playback.next();
    playback.next();
    playback.next();
    expect(playback.index).toBe(4);
    expect(playback.playing).toBe(false);
    playback.setLength(8);
    expect(playback.index).toBe(4);
    expect(playback.playing).toBe(false);
    expect(manual.pending()).toEqual([]);
  });

  it("resets to the first step and keeps speed and length", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 4, speed: 1, stepMs: 100, clock: manual.clock });
    playback.setSpeed(4);
    playback.next();
    playback.next();
    playback.play();

    playback.reset();
    expect(playback.index).toBe(0);
    expect(playback.playing).toBe(false);
    expect(playback.speed).toBe(4);
    expect(playback.length).toBe(4);
    expect(manual.pending()).toEqual([]);

    playback.reset();
    expect(playback.index).toBe(0);
    expect(playback.playing).toBe(false);
  });

  it("notifies subscribers only when something changed", () => {
    const playback = createPlayback({ length: 2, speed: 1 });
    let calls = 0;
    const unsubscribe = playback.subscribe(() => {
      calls += 1;
    });

    playback.previous();
    playback.pause();
    playback.reset();
    playback.setSpeed(1);
    playback.setLength(2);
    expect(calls).toBe(0);

    playback.next();
    expect(calls).toBe(1);
    expect(playback.index).toBe(1);

    unsubscribe();
    playback.previous();
    expect(calls).toBe(1);
    expect(playback.index).toBe(0);
  });

  it("uses the default speed and step interval", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 3, clock: manual.clock });
    expect(playback.speed).toBe(DEFAULT_PLAYBACK_SPEED);
    playback.play();
    expect(manual.pending()[0]?.delayMs).toBe(DEFAULT_PLAYBACK_STEP_MS);
  });

  it("rejects invalid length, speed, and step interval without changing state", () => {
    expect(() => createPlayback({ length: -1 })).toThrow(/non-negative integer/);
    expect(() => createPlayback({ length: 1.5 })).toThrow(/non-negative integer/);
    expect(() => createPlayback({ speed: 0 })).toThrow(/speed/);
    expect(() => createPlayback({ speed: Number.POSITIVE_INFINITY })).toThrow(/speed/);
    expect(() => createPlayback({ speed: Number.NaN })).toThrow(/speed/);
    expect(() => createPlayback({ stepMs: 0 })).toThrow(/stepMs/);
    expect(() => createPlayback({ stepMs: Number.NaN })).toThrow(/stepMs/);

    const playback = createPlayback({ length: 4, speed: 2 });
    expect(() => playback.setLength(-1)).toThrow(RangeError);
    expect(playback.length).toBe(4);
    expect(playback.index).toBe(0);
    expect(() => playback.setSpeed(Number.NaN)).toThrow(RangeError);
    expect(playback.speed).toBe(2);
  });

  it("stops the timer on dispose and rejects later use", () => {
    const manual = createManualClock();
    const playback = createPlayback({ length: 3, stepMs: 100, clock: manual.clock });
    playback.play();
    playback.dispose();
    expect(manual.pending()).toEqual([]);
    expect(playback.playing).toBe(false);
    expect(() => playback.next()).toThrow(/disposed/);
    expect(() => playback.play()).toThrow(/disposed/);
    playback.dispose();
  });
});

function createManualClock() {
  let nextId = 1;
  const entries = new Map<number, { delayMs: number; callback: () => void }>();
  return {
    clock: {
      setTimeout(callback: () => void, delayMs: number) {
        const id = nextId;
        nextId += 1;
        entries.set(id, { delayMs, callback });
        return id;
      },
      clearTimeout(handle: unknown) {
        if (typeof handle === "number") entries.delete(handle);
      },
    } satisfies PlaybackClock,
    pending() {
      return [...entries.entries()].map(([id, entry]) => ({ id, delayMs: entry.delayMs }));
    },
    fireNext() {
      const next = entries.entries().next().value;
      if (!next) throw new Error("No timeout is pending.");
      const [id, entry] = next;
      entries.delete(id);
      entry.callback();
    },
  };
}

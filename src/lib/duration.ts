import { useEffect, useRef, useState } from "react";
import type { Track } from "../types";
import { resolveMediaSrc } from "./platform";

const cache = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

interface Task {
  track: Track;
  resolve: (duration: number) => void;
}

const queue: Task[] = [];
let active = 0;
const MAX_ACTIVE = 3;

function pump(): void {
  while (active < MAX_ACTIVE && queue.length > 0) {
    const task = queue.shift();
    if (!task) return;
    active += 1;
    loadDuration(task.track).then((duration) => {
      active -= 1;
      task.resolve(duration);
      pump();
    });
  }
}

function loadDuration(track: Track): Promise<number> {
  const src = resolveMediaSrc(track);
  if (!src) return Promise.resolve(0);

  return new Promise<number>((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (duration: number): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      cache.set(track.id, duration);
      resolve(duration);
    };
    const timer = window.setTimeout(() => finish(0), 12000);

    audio.preload = "metadata";
    audio.addEventListener(
      "loadedmetadata",
      () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        finish(duration);
      },
      { once: true },
    );
    audio.addEventListener("error", () => finish(0), { once: true });
    audio.src = src;
    audio.load();
  });
}

export function requestDuration(track: Track): Promise<number> {
  if (cache.has(track.id)) return Promise.resolve(cache.get(track.id) ?? 0);
  const existing = inFlight.get(track.id);
  if (existing) return existing;

  const promise = new Promise<number>((resolve) => {
    queue.push({ track, resolve });
    pump();
  }).then((duration) => {
    inFlight.delete(track.id);
    return duration;
  });

  inFlight.set(track.id, promise);
  return promise;
}

/**
 * Loads duration lazily when a row approaches the viewport, keeping large
 * libraries cheap to render.
 */
export function useTrackDuration(track: Track): {
  duration: number;
  ref: React.RefObject<HTMLDivElement | null>;
} {
  const [duration, setDuration] = useState<number>(() => cache.get(track.id) ?? 0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    if (cache.has(track.id)) {
      setDuration(cache.get(track.id) ?? 0);
      return;
    }

    setDuration(0);
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void requestDuration(track).then((value) => {
          if (!cancelled) setDuration(value);
        });
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [track.id]);

  return { duration, ref };
}

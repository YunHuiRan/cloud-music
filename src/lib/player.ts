import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepeatMode, Track } from "../types";
import { useLibrary } from "./store";
import { nativeBridge, resolveMediaSrc } from "./platform";
import { toast } from "./toast";

interface PlayerState {
  queue: string[];
  currentId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  visibleIds: string[];
  error: string | null;
  playTracks: (trackIds: string[], startId: string) => void;
  playTrack: (trackId: string) => void;
  playAt: (index: number) => void;
  toggle: () => void;
  next: (automatic?: boolean) => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  playShuffle: (trackIds?: string[]) => void;
  playOrder: (trackIds?: string[]) => void;
  cycleRepeat: () => void;
  setVisibleIds: (ids: string[]) => void;
  clearQueue: () => void;
  pruneQueue: (ids: Iterable<string>) => void;
}

let audio: HTMLAudioElement | null = null;
let loadedSrc: string | null = null;
let mediaSessionReady = false;
let lastErrorSrc: string | null = null;

function findTrack(id: string): Track | undefined {
  return useLibrary.getState().tracks.find((track) => track.id === id);
}

function syncNativeMediaSession(): void {
  if (!nativeBridge?.updateMediaSession) return;
  const state = usePlayer.getState();
  const track = state.currentId ? findTrack(state.currentId) : undefined;
  if (!track) {
    nativeBridge.clearMediaSession?.();
    return;
  }
  nativeBridge.updateMediaSession({
    title: track.title,
    artist: track.artists.join(" & "),
    isPlaying: state.isPlaying,
    position: state.currentTime,
    duration: state.duration,
    canNext: state.queue.length > 1,
    canPrev: state.queue.length > 1,
  });
}

function updateMediaSession(track: Track): void {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.join(" & "),
      album: "Cloud Music",
    });
  }
  syncNativeMediaSession();
}

function installMediaSession(): void {
  if (mediaSessionReady || !("mediaSession" in navigator)) return;
  mediaSessionReady = true;
  navigator.mediaSession.setActionHandler("play", () => {
    if (!usePlayer.getState().isPlaying) usePlayer.getState().toggle();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    if (usePlayer.getState().isPlaying) usePlayer.getState().toggle();
  });
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    usePlayer.getState().previous();
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => usePlayer.getState().next());
  navigator.mediaSession.setActionHandler("seekbackward", (details) => {
    usePlayer.getState().seekTo(usePlayer.getState().currentTime - (details.seekOffset ?? 10));
  });
  navigator.mediaSession.setActionHandler("seekforward", (details) => {
    usePlayer.getState().seekTo(usePlayer.getState().currentTime + (details.seekOffset ?? 10));
  });
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (typeof details.seekTime === "number") {
      usePlayer.getState().seekTo(details.seekTime);
    }
  });
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;

  const element = new Audio();
  element.preload = "metadata";
  const initial = usePlayer.getState();
  element.volume = initial.volume;
  element.muted = initial.muted;

  element.addEventListener("loadedmetadata", () => {
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    usePlayer.setState({ duration });
    syncNativeMediaSession();
    try {
      if ("mediaSession" in navigator && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(element.currentTime, duration),
          playbackRate: element.playbackRate,
        });
      }
    } catch {
      // Position state is optional.
    }
  });
  element.addEventListener("durationchange", () => {
    if (Number.isFinite(element.duration)) {
      usePlayer.setState({ duration: element.duration });
      syncNativeMediaSession();
    }
  });
  element.addEventListener("timeupdate", () => {
    usePlayer.setState({ currentTime: element.currentTime });
    try {
      if (
        "mediaSession" in navigator &&
        Number.isFinite(element.duration) &&
        element.duration > 0
      ) {
        navigator.mediaSession.setPositionState({
          duration: element.duration,
          position: Math.min(element.currentTime, element.duration),
          playbackRate: element.playbackRate,
        });
      }
    } catch {
      // Position state is optional.
    }
  });
  element.addEventListener("progress", () => {
    if (element.buffered.length === 0) return;
    usePlayer.setState({
      buffered: element.buffered.end(element.buffered.length - 1),
    });
  });
  element.addEventListener("play", () => {
    usePlayer.setState({ isPlaying: true, error: null });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
    syncNativeMediaSession();
  });
  element.addEventListener("pause", () => {
    usePlayer.setState({ isPlaying: false });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
    syncNativeMediaSession();
  });
  element.addEventListener("waiting", () => {
    usePlayer.setState({ isLoading: true });
  });
  element.addEventListener("playing", () => {
    usePlayer.setState({ isLoading: false, error: null });
  });
  element.addEventListener("canplay", () => {
    usePlayer.setState({ isLoading: false });
  });
  element.addEventListener("ended", () => {
    const state = usePlayer.getState();
    if (state.repeat === "one") {
      element.currentTime = 0;
      void element.play();
      return;
    }
    state.next(true);
  });
  element.addEventListener("error", () => {
    if (!loadedSrc) return;
    if (lastErrorSrc === loadedSrc) return;
    lastErrorSrc = loadedSrc;
    usePlayer.setState({
      isPlaying: false,
      isLoading: false,
      error: "这首歌暂时无法播放",
    });
    syncNativeMediaSession();
    toast("无法播放这首歌，请检查文件是否还存在");
  });

  audio = element;
  return element;
}

function loadAndPlay(trackId: string, autoplay: boolean): void {
  const track = findTrack(trackId);
  if (!track) {
    usePlayer.setState({ isPlaying: false, error: "找不到这首歌" });
    toast("找不到这首歌，它可能已被移除");
    return;
  }

  const src = resolveMediaSrc(track);
  if (!src) {
    usePlayer.setState({
      isPlaying: false,
      error: "浏览器模式需要重新选择文件",
    });
    toast("文件链接已失效，请重新选择音乐文件");
    return;
  }

  const element = ensureAudio();
  if (loadedSrc !== src) {
    loadedSrc = src;
    lastErrorSrc = null;
    element.src = src;
  }

  usePlayer.setState({
    currentId: trackId,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isLoading: autoplay,
    error: null,
  });
  updateMediaSession(track);
  installMediaSession();

  if (!autoplay) {
    element.load();
    return;
  }

  element.load();
  const promise = element.play();
  if (promise) {
    promise.catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      usePlayer.setState({
        isPlaying: false,
        isLoading: false,
        error: "这首歌暂时无法播放",
      });
    });
  }
}

function startTrack(trackId: string): void {
  loadAndPlay(trackId, true);
}

function shuffled(items: string[]): string[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function startMode(mode: "order" | "shuffle", trackIds?: string[]): void {
  const state = usePlayer.getState();
  const source =
    trackIds ??
    (state.queue.length > 0
      ? state.queue
      : useLibrary.getState().tracks.map((track) => track.id));
  const unique = Array.from(new Set(source));
  if (unique.length === 0) {
    toast("当前播放列表里还没有歌曲");
    return;
  }
  const ordered = mode === "shuffle" ? shuffled(unique) : unique;
  setPlayerQueue(ordered, mode === "shuffle");
  startTrack(ordered[0]);
}

function setPlayerQueue(queue: string[], shuffle: boolean): void {
  usePlayer.setState({
    queue,
    shuffle,
    currentId: queue[0] ?? null,
    isPlaying: true,
  });
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentId: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 0.8,
      muted: false,
      shuffle: false,
      repeat: "off",
      visibleIds: [],
      error: null,

      playTracks: (trackIds, startId) => {
        const state = get();
        const unique = Array.from(new Set(trackIds));
        if (!unique.includes(startId)) unique.push(startId);
        if (state.currentId === startId && loadedSrc) {
          set({ queue: unique });
          get().toggle();
          return;
        }
        set({ queue: unique, currentId: startId, isPlaying: true });
        startTrack(startId);
      },

      playTrack: (trackId) => {
        const state = get();
        if (!state.queue.includes(trackId)) {
          set({ queue: [trackId] });
        }
        if (state.currentId === trackId && loadedSrc) {
          get().toggle();
          return;
        }
        set({ currentId: trackId, isPlaying: true });
        startTrack(trackId);
      },

      playAt: (index) => {
        const state = get();
        const id = state.queue[index];
        if (!id) return;
        if (state.currentId === id && loadedSrc) {
          get().toggle();
          return;
        }
        startTrack(id);
      },

      toggle: () => {
        const state = get();
        if (!state.currentId) {
          if (state.queue.length > 0) {
            startTrack(state.queue[0]);
          }
          return;
        }
        const element = ensureAudio();
        if (element.paused) {
          const promise = element.play();
          if (promise) {
            promise.catch(() => set({ isPlaying: false }));
          }
        } else {
          element.pause();
        }
      },

      next: (automatic = false) => {
        const state = get();
        if (state.queue.length === 0) return;
        if (state.shuffle && state.queue.length > 1) {
          let index = state.queue.indexOf(state.currentId ?? "");
          let next = index;
          while (next === index) {
            next = Math.floor(Math.random() * state.queue.length);
          }
          startTrack(state.queue[next]);
          return;
        }
        const index = state.currentId ? state.queue.indexOf(state.currentId) : -1;
        let nextIndex = index + 1;
        if (nextIndex >= state.queue.length) {
          if (automatic && state.repeat !== "all") {
            set({ isPlaying: false });
            ensureAudio().pause();
            return;
          }
          nextIndex = 0;
        }
        if (nextIndex < 0) nextIndex = 0;
        startTrack(state.queue[nextIndex]);
      },

      previous: () => {
        const state = get();
        if (state.currentTime > 3) {
          get().seekTo(0);
          return;
        }
        if (state.queue.length === 0) return;
        if (state.shuffle && state.queue.length > 1) {
          let index = state.queue.indexOf(state.currentId ?? "");
          let previous = index;
          while (previous === index) {
            previous = Math.floor(Math.random() * state.queue.length);
          }
          startTrack(state.queue[previous]);
          return;
        }
        const index = state.currentId ? state.queue.indexOf(state.currentId) : 0;
        let previousIndex = index - 1;
        if (previousIndex < 0) previousIndex = state.queue.length - 1;
        startTrack(state.queue[previousIndex]);
      },

      seekTo: (seconds) => {
        if (!get().currentId) return;
        const element = ensureAudio();
        const max = Number.isFinite(element.duration)
          ? element.duration
          : get().duration;
        if (!max) return;
        const next = Math.max(0, Math.min(seconds, max));
        element.currentTime = next;
        set({ currentTime: next });
        syncNativeMediaSession();
      },

      setVolume: (volume) => {
        const next = Math.max(0, Math.min(1, volume));
        const element = ensureAudio();
        element.volume = next;
        element.muted = false;
        set({ volume: next, muted: false });
      },

      toggleMute: () => {
        const element = ensureAudio();
        const next = !get().muted;
        element.muted = next;
        set({ muted: next });
      },

      playShuffle: (trackIds) => startMode("shuffle", trackIds),

      playOrder: (trackIds) => startMode("order", trackIds),

      cycleRepeat: () => {
        const current = get().repeat;
        const next: RepeatMode =
          current === "off" ? "all" : current === "all" ? "one" : "off";
        set({ repeat: next });
      },

      setVisibleIds: (ids) => {
        const current = get().visibleIds;
        if (
          current.length === ids.length &&
          current.every((id, index) => id === ids[index])
        ) {
          return;
        }
        set({ visibleIds: ids });
      },

      clearQueue: () => {
        if (audio) {
          audio.pause();
          loadedSrc = null;
          audio.removeAttribute("src");
          audio.load();
        }
        set({
          queue: [],
          currentId: null,
          isPlaying: false,
          isLoading: false,
          currentTime: 0,
          duration: 0,
          buffered: 0,
          error: null,
        });
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = null;
        }
        nativeBridge?.clearMediaSession?.();
      },

      pruneQueue: (ids) => {
        const removed = new Set(ids);
        if (removed.size === 0) return;
        const state = get();
        const queue = state.queue.filter((id) => !removed.has(id));
        if (!state.currentId || !removed.has(state.currentId)) {
          set({ queue });
          syncNativeMediaSession();
          return;
        }
        if (audio) {
          audio.pause();
          loadedSrc = null;
          audio.removeAttribute("src");
          audio.load();
        }
        set({
          queue,
          currentId: queue[0] ?? null,
          isPlaying: false,
          isLoading: false,
          currentTime: 0,
          duration: 0,
          buffered: 0,
          error: null,
        });
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = null;
        }
        nativeBridge?.clearMediaSession?.();
      },
    }),
    {
      name: "shiyin.player.v1",
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
      }),
    },
  ),
);

let nativeActionsReady = false;

function installNativeMediaActions(): void {
  if (nativeActionsReady || !nativeBridge?.onMediaAction) return;
  nativeActionsReady = true;
  nativeBridge.onMediaAction((action, position) => {
    const state = usePlayer.getState();
    if (action === "play") {
      if (!state.isPlaying) state.toggle();
      return;
    }
    if (action === "pause") {
      if (state.isPlaying) state.toggle();
      return;
    }
    if (action === "next") {
      state.next();
      return;
    }
    if (action === "previous") {
      state.previous();
      return;
    }
    if (action === "seek" && typeof position === "number") {
      state.seekTo(position / 1000);
      return;
    }
    if (action === "stop") {
      state.clearQueue();
    }
  });
}

installNativeMediaActions();

/** Keep the media element in sync with volume changes made elsewhere. */
export function syncPlayerVolume(): void {
  if (!audio) return;
  const state = usePlayer.getState();
  audio.volume = state.volume;
  audio.muted = state.muted;
}

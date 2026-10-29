import type { CloseBehavior, ScannedTrack, Track } from "../types";
import { capacitorBridge } from "./capacitor";
import { parseTrackName } from "./parser";

export interface MediaSessionState {
  title: string;
  artist: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  canNext: boolean;
  canPrev: boolean;
}

export interface NativeBridge {
  platform: "electron" | "capacitor";
  version?: string;
  autoDemo?: boolean;
  pickFolder?: () => Promise<string | null>;
  scanFolder?: (folder: string) => Promise<ScannedTrack[]>;
  scanDemo?: () => Promise<ScannedTrack[]>;
  authorize?: (paths: string[]) => Promise<number>;
  mediaSrc?: (path: string) => string;
  getCloseBehavior?: () => Promise<CloseBehavior>;
  setCloseBehavior?: (behavior: CloseBehavior) => Promise<CloseBehavior>;
  quit?: () => Promise<void>;
  refreshLibrary?: (
    entries: Array<{ id: string; path: string }>,
  ) => Promise<{ valid: string[]; missing: string[] }>;
  updateMediaSession?: (state: MediaSessionState) => void;
  clearMediaSession?: () => void;
  onMediaAction?: (
    callback: (action: string, position?: number) => void,
  ) => void;
  onDropped?: (callback: (tracks: ScannedTrack[]) => void) => void;
  offDropped?: () => void;
}

declare global {
  interface Window {
    shiyin?: NativeBridge;
  }
}

export const nativeBridge: NativeBridge | undefined =
  window.shiyin ?? capacitorBridge;

export function isNativePlatform(): boolean {
  return Boolean(nativeBridge);
}

export function trackFromScanned(file: ScannedTrack, addedAt = Date.now()): Track {
  const parsed = parseTrackName(file.fileName);
  return {
    id: file.id,
    path: file.path,
    fileName: file.fileName,
    relativePath: file.relativePath,
    size: file.size,
    addedAt,
    title: parsed.title,
    artists: parsed.artists,
  };
}

export function tracksFromWebFiles(files: File[]): Track[] {
  const now = Date.now();
  return files.map((file) => {
    const parsed = parseTrackName(file.name);
    const relativePath = file.webkitRelativePath || file.name;
    const id = `web:${relativePath}:${file.size}:${file.lastModified}`;
    return {
      id,
      path: "",
      fileName: file.name,
      relativePath,
      size: file.size,
      addedAt: now,
      title: parsed.title,
      artists: parsed.artists,
      url: URL.createObjectURL(file),
    };
  });
}

export function resolveMediaSrc(track: Track): string | null {
  if (track.url) return track.url;
  if (nativeBridge?.mediaSrc && track.path) {
    return nativeBridge.mediaSrc(track.path);
  }
  if (nativeBridge?.platform === "electron" && track.path) {
    return `aria-media://local/${encodeURIComponent(track.path)}`;
  }
  return null;
}

export type SortMode = "title" | "artist" | "added";
export type Theme = "light" | "dark";
export type RepeatMode = "off" | "all" | "one";
export type CloseBehavior = "ask" | "minimize" | "quit";
export type PlayMode = "order" | "shuffle";

export interface Track {
  /** Stable identity: the absolute path for native libraries, a generated key on the web. */
  id: string;
  title: string;
  artists: string[];
  fileName: string;
  relativePath: string;
  /** Absolute local path on native platforms. */
  path: string;
  size: number;
  addedAt: number;
  /** Transient object URL used by the browser fallback. Never persisted. */
  url?: string;
}

export interface ScannedTrack {
  id: string;
  path: string;
  fileName: string;
  relativePath: string;
  size: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export type View =
  | { kind: "library" }
  | { kind: "artists" }
  | { kind: "playlists" }
  | { kind: "playlist"; id: string }
  | { kind: "liked" };

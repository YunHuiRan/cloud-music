import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Playlist, SortMode, Theme, Track } from "../types";
import { tracksFromWebFiles, trackFromScanned, isNativePlatform } from "./platform";
import type { ScannedTrack } from "../types";

interface LibraryState {
  tracks: Track[];
  invalidTracks: Track[];
  folders: string[];
  playlists: Playlist[];
  liked: string[];
  theme: Theme;
  sort: SortMode;
  importScanned: (files: ScannedTrack[], folder?: string) => number;
  importWebFiles: (files: File[]) => number;
  replaceTracks: (replacements: Array<{ oldId: string; file: ScannedTrack }>) => void;
  removeTracks: (ids: Iterable<string>) => void;
  refreshLibrary: (validIds: string[], missingIds: string[]) => void;
  clearInvalid: () => void;
  toggleLike: (trackId: string) => void;
  createPlaylist: (name: string, trackIds?: string[]) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, trackIds: string[]) => void;
  removeFromPlaylist: (id: string, trackId: string) => void;
  togglePlaylistTrack: (id: string, trackId: string) => boolean;
  setTheme: (theme: Theme) => void;
  setSort: (sort: SortMode) => void;
}

function themeFromDocument(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#171c26" : "#f5f7fc");
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      tracks: [],
      invalidTracks: [],
      folders: [],
      playlists: [],
      liked: [],
      theme: themeFromDocument(),
      sort: "title",

      importScanned: (files, folder) => {
        const existing = new Map(get().tracks.map((track) => [track.id, track]));
        let added = 0;
        const fresh = files.map((file) => {
          const old = existing.get(file.id);
          if (!old) added += 1;
          return trackFromScanned(file, old?.addedAt);
        });
        const freshIds = new Set(fresh.map((track) => track.id));
        set((state) => ({
          tracks: [...state.tracks.filter((track) => !freshIds.has(track.id)), ...fresh],
          invalidTracks: state.invalidTracks.filter((track) => !freshIds.has(track.id)),
          folders: folder
            ? Array.from(new Set([...state.folders, folder]))
            : state.folders,
        }));
        return added;
      },

      importWebFiles: (files) => {
        const fresh = tracksFromWebFiles(files);
        const existing = new Map(get().tracks.map((track) => [track.id, track]));
        let added = 0;
        for (const track of fresh) {
          const old = existing.get(track.id);
          if (old) {
            track.addedAt = old.addedAt;
          } else {
            added += 1;
          }
        }
        const freshIds = new Set(fresh.map((track) => track.id));
        set((state) => ({
          tracks: [...state.tracks.filter((track) => !freshIds.has(track.id)), ...fresh],
        }));
        return added;
      },

      replaceTracks: (replacements) => {
        if (replacements.length === 0) return;
        const byId = new Map(
          replacements.map((item) => [item.oldId, item.file]),
        );
        set((state) => ({
          tracks: state.tracks.map((track) => {
            const file = byId.get(track.id);
            if (!file) return track;
            return { ...trackFromScanned(file, track.addedAt), id: track.id };
          }),
          invalidTracks: state.invalidTracks.filter(
            (track) => !byId.has(track.id),
          ),
        }));
      },

      removeTracks: (ids) => {
        const remove = new Set(ids);
        if (remove.size === 0) return;
        set((state) => ({
          tracks: state.tracks.filter((track) => !remove.has(track.id)),
          liked: state.liked.filter((id) => !remove.has(id)),
          playlists: state.playlists.map((playlist) => ({
            ...playlist,
            trackIds: playlist.trackIds.filter((id) => !remove.has(id)),
          })),
        }));
      },

      refreshLibrary: (validIds, missingIds) => {
        const missing = new Set(missingIds);
        if (missing.size === 0) return;
        const valid = new Set(validIds);
        set((state) => {
          const gone = state.tracks.filter((track) => missing.has(track.id));
          return {
            tracks: state.tracks.filter(
              (track) => !missing.has(track.id) || valid.has(track.id),
            ),
            invalidTracks: [
              ...state.invalidTracks.filter((track) => !missing.has(track.id)),
              ...gone,
            ],
            liked: state.liked.filter((id) => !missing.has(id)),
            playlists: state.playlists.map((playlist) => ({
              ...playlist,
              trackIds: playlist.trackIds.filter((id) => !missing.has(id)),
            })),
          };
        });
      },

      clearInvalid: () => set({ invalidTracks: [] }),

      toggleLike: (trackId) => {
        set((state) => ({
          liked: state.liked.includes(trackId)
            ? state.liked.filter((id) => id !== trackId)
            : [trackId, ...state.liked],
        }));
      },

      createPlaylist: (name, trackIds = []) => {
        const id = newId();
        const playlist: Playlist = {
          id,
          name: name.trim() || "新建歌单",
          trackIds: Array.from(new Set(trackIds)),
          createdAt: Date.now(),
        };
        set((state) => ({ playlists: [...state.playlists, playlist] }));
        return id;
      },

      renamePlaylist: (id, name) => {
        const next = name.trim();
        if (!next) return;
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === id ? { ...playlist, name: next } : playlist,
          ),
        }));
      },

      deletePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((playlist) => playlist.id !== id),
        }));
      },

      addToPlaylist: (id, trackIds) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== id) return playlist;
            return {
              ...playlist,
              trackIds: Array.from(new Set([...playlist.trackIds, ...trackIds])),
            };
          }),
        }));
      },

      removeFromPlaylist: (id, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === id
              ? {
                  ...playlist,
                  trackIds: playlist.trackIds.filter((item) => item !== trackId),
                }
              : playlist,
          ),
        }));
      },

      togglePlaylistTrack: (id, trackId) => {
        let added = false;
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== id) return playlist;
            if (playlist.trackIds.includes(trackId)) {
              return {
                ...playlist,
                trackIds: playlist.trackIds.filter((item) => item !== trackId),
              };
            }
            added = true;
            return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
          }),
        }));
        return added;
      },

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      setSort: (sort) => set({ sort }),
    }),
    {
      name: "shiyin.library.v1",
      version: 1,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<LibraryState>;
        return {
          ...current,
          ...saved,
          invalidTracks: saved.invalidTracks ?? [],
        };
      },
      partialize: (state) => ({
        tracks: isNativePlatform()
          ? state.tracks.map((track) => {
              const copy: Track = { ...track };
              delete copy.url;
              return copy;
            })
          : [],
        invalidTracks: isNativePlatform()
          ? state.invalidTracks.map((track) => {
              const copy: Track = { ...track };
              delete copy.url;
              return copy;
            })
          : [],
        folders: state.folders,
        playlists: state.playlists,
        liked: state.liked,
        theme: state.theme,
        sort: state.sort,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

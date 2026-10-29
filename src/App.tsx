import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { FolderDown } from "lucide-react";
import type { ScannedTrack, Track, View } from "./types";
import { useLibrary } from "./lib/store";
import { usePlayer } from "./lib/player";
import { nativeBridge, isNativePlatform } from "./lib/platform";
import { applyAndroidTheme } from "./lib/android-shell";
import { AUDIO_EXTENSIONS, isAudioFile } from "./lib/parser";
import { findDuplicateMatches } from "./lib/duplicates";
import type { DuplicateChoice, DuplicateMatch } from "./lib/duplicates";
import { matchesShortcut, useSettings } from "./lib/settings";
import { toast } from "./lib/toast";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PlayerBar } from "./components/PlayerBar";
import { MobileNav } from "./components/MobileNav";
import { QueueDrawer } from "./components/QueueDrawer";
import { Toasts } from "./components/Toasts";
import { AddToPlaylistDialog, NewPlaylistDialog } from "./components/PlaylistDialogs";
import { DuplicateDialog } from "./components/DuplicateDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { LibraryView } from "./views/LibraryView";
import { ArtistsView } from "./views/ArtistsView";
import { PlaylistsView } from "./views/PlaylistsView";
import { PlaylistView } from "./views/PlaylistView";
import { LikedView } from "./views/LikedView";

const IS_NATIVE = isNativePlatform();
const ACCEPT = AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",");
let autoDemoStarted = false;

function focusSearch(): void {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-search-input]"),
  );
  const target = inputs.find((input) => input.offsetParent !== null) ?? inputs[0];
  target?.focus();
  target?.select();
}

export default function App() {
  const theme = useLibrary((state) => state.theme);
  const setTheme = useLibrary((state) => state.setTheme);
  const playlists = useLibrary((state) => state.playlists);
  const tracks = useLibrary((state) => state.tracks);
  const [view, setView] = useState<View>({ kind: "library" });
  const [query, setQuery] = useState("");
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [addTrack, setAddTrack] = useState<Track | null>(null);
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistTracks, setNewPlaylistTracks] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<{
    files: ScannedTrack[];
    folder?: string;
    matches: DuplicateMatch[];
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const importFilesRef = useRef<(files: ScannedTrack[]) => void>(() => {});

  useEffect(() => {
    applyAndroidTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onBack = (event: Event) => {
      if (pendingImport) {
        setPendingImport(null);
        event.preventDefault();
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        event.preventDefault();
        return;
      }
      if (addTrack) {
        setAddTrack(null);
        event.preventDefault();
        return;
      }
      if (newPlaylistOpen) {
        setNewPlaylistOpen(false);
        event.preventDefault();
        return;
      }
      if (queueOpen) {
        setQueueOpen(false);
        event.preventDefault();
        return;
      }
      if (view.kind !== "library") {
        setView({ kind: "library" });
        event.preventDefault();
      }
    };
    window.addEventListener("shiyin:android-back", onBack);
    return () => window.removeEventListener("shiyin:android-back", onBack);
  }, [pendingImport, settingsOpen, addTrack, newPlaylistOpen, queueOpen, view]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    const paths = useLibrary
      .getState()
      .tracks.map((track) => track.path)
      .filter(Boolean);
    if (paths.length > 0) {
      void nativeBridge?.authorize?.(paths);
    }
  }, []);

  useEffect(() => {
    if (!nativeBridge?.autoDemo || autoDemoStarted) return;
    autoDemoStarted = true;
    void (async () => {
      const files = await nativeBridge.scanDemo?.();
      if (files && files.length > 0) {
        useLibrary.getState().importScanned(files, "内置示例");
      }    })();
  }, []);

  useEffect(() => {
    if (!nativeBridge?.onDropped) return;
    nativeBridge.onDropped((files) => {
      setDragging(false);
      dragDepth.current = 0;
      if (files.length === 0) {
        toast("没有找到可播放的音频文件");
        return;
      }
      importFilesRef.current(files);
    });
    return () => nativeBridge?.offDropped?.();
  }, []);

  useEffect(() => {
    const resetDrag = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    window.addEventListener("dragend", resetDrag);
    window.addEventListener("blur", resetDrag);
    return () => {
      window.removeEventListener("dragend", resetDrag);
      window.removeEventListener("blur", resetDrag);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const interactive = Boolean(
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='button']",
        ),
      );
      const modalOpen = Boolean(document.querySelector("[data-modal-open]"));

      if (event.key === "Escape" && !modalOpen) {
        setQueueOpen(false);
        return;
      }
      if (interactive || modalOpen || event.repeat) return;

      const shortcuts = useSettings.getState().shortcuts;
      if (matchesShortcut(event, shortcuts.search)) {
        event.preventDefault();
        focusSearch();
        return;
      }
      if (matchesShortcut(event, shortcuts.togglePlayback)) {
        event.preventDefault();
        usePlayer.getState().toggle();
        return;
      }
      if (matchesShortcut(event, shortcuts.previous)) {
        event.preventDefault();
        usePlayer.getState().previous();
        return;
      }
      if (matchesShortcut(event, shortcuts.next)) {
        event.preventDefault();
        usePlayer.getState().next();
        return;
      }
      if (matchesShortcut(event, shortcuts.volumeUp)) {
        event.preventDefault();
        const player = usePlayer.getState();
        player.setVolume(player.volume + 0.05);
        return;
      }
      if (matchesShortcut(event, shortcuts.volumeDown)) {
        event.preventDefault();
        const player = usePlayer.getState();
        player.setVolume(player.volume - 0.05);
        return;
      }
      if (matchesShortcut(event, shortcuts.mute)) {
        event.preventDefault();
        usePlayer.getState().toggleMute();
        return;
      }
      if (matchesShortcut(event, shortcuts.openSettings)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const navigate = (next: View) => {
    setView(next);
    if (next.kind !== "library") {
      setSelectedArtists([]);
      setQuery("");
    }
    if (next.kind === "library") {
      setSelectedArtists([]);
      setQuery("");
    }
  };

  const openArtist = (artist: string) => {
    setSelectedArtists([artist]);
    setQuery("");
    setView({ kind: "library" });
  };

  const toggleArtist = (artist: string) => {
    setSelectedArtists((current) =>
      current.includes(artist)
        ? current.filter((item) => item !== artist)
        : [artist, ...current],
    );
  };

  const clearFilters = () => {
    setSelectedArtists([]);
    setQuery("");
  };

  const runImport = (
    files: ScannedTrack[],
    folder?: string,
    choices = new Map<string, DuplicateChoice>(),
  ) => {
    const matches = pendingImport?.matches ?? [];
    const decisionFor = (match: DuplicateMatch): DuplicateChoice =>
      choices.get(match.incoming.id) ?? "existing";
    const replacements = matches
      .filter((match) => decisionFor(match) === "incoming")
      .map((match) => ({ oldId: match.existing.id, file: match.incoming }));
    const both = matches.filter((match) => decisionFor(match) === "both");
    const kept = matches.filter((match) => decisionFor(match) === "existing").length;
    const skipped = new Set(
      matches
        .filter((match) => decisionFor(match) !== "both")
        .map((match) => match.incoming.id),
    );
    const fresh = files.filter((file) => !skipped.has(file.id));
    if (replacements.length > 0) {
      useLibrary.getState().replaceTracks(replacements);
    }
    const added = useLibrary.getState().importScanned(fresh, folder);
    setPendingImport(null);
    setView({ kind: "library" });
    setSelectedArtists([]);
    setQuery("");
    const parts = [`已导入 ${added} 首`];
    if (replacements.length > 0) parts.push(`更新 ${replacements.length} 首`);
    if (kept > 0) parts.push(`保留原版本 ${kept} 首`);
    if (both.length > 0) parts.push(`同名保留 ${both.length} 首`);
    toast(parts.join("，"));
  };

  const importFiles = (files: ScannedTrack[], folder?: string) => {
    if (files.length === 0) {
      toast("没有找到可播放的音频文件");
      return;
    }
    const matches = findDuplicateMatches(tracks, files);
    if (matches.length > 0) {
      setPendingImport({ files, folder, matches });
      return;
    }
    runImport(files, folder);
  };

  importFilesRef.current = importFiles;

  const importFromFolder = async () => {
    if (!nativeBridge?.pickFolder || !nativeBridge.scanFolder) {
      fileInputRef.current?.click();
      return;
    }
    const folder = await nativeBridge.pickFolder();
    if (!folder) return;
    setImporting(true);
    try {
      const files = await nativeBridge.scanFolder(folder);
      if (files.length === 0) {
        toast("这个文件夹里没有找到音频文件");
        return;
      }
      importFiles(files, folder);
    } catch {
      toast("读取文件夹失败，请换一个文件夹试试");
    } finally {
      setImporting(false);
    }
  };

  const importFromFiles = (files: File[]) => {
    if (IS_NATIVE) {
      toast("桌面端请把文件或文件夹拖入窗口，或使用「导入文件夹」");
      return;
    }
    const audio = files.filter((file) => isAudioFile(file.name));
    if (audio.length === 0) {
      toast("没有找到可播放的音频文件");
      return;
    }
    const added = useLibrary.getState().importWebFiles(audio);
    setView({ kind: "library" });
    setSelectedArtists([]);
    setQuery("");
    toast(added > 0 ? `已导入 ${added} 首歌` : `已更新 ${audio.length} 首歌`);
  };

  const hasFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    // Electron resolves real paths in the preload; browser drops use object URLs.
    if (IS_NATIVE) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) importFromFiles(files);
  };

  return (
    <div
      className="app-shell"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Sidebar
        view={view}
        playlists={playlists}
        onNavigate={navigate}
        onCreatePlaylist={() => setNewPlaylistOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onImport={() => void importFromFolder()}
        importing={importing}
      />

      <div className="main">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="content" ref={contentRef}>
          {view.kind === "library" && (
            <LibraryView
              query={query}
              selectedArtists={selectedArtists}
              isNative={IS_NATIVE}
              importing={importing}
              onToggleArtist={toggleArtist}
              onClearArtists={() => setSelectedArtists([])}
              onOpenArtists={() => navigate({ kind: "artists" })}
              onArtistClick={openArtist}
              onAdd={setAddTrack}
              onCreatePlaylist={(trackIds) => {
                setNewPlaylistTracks(trackIds);
                setNewPlaylistOpen(true);
              }}
              onImport={importFromFolder}
              onClearFilters={clearFilters}
            />
          )}

          {view.kind === "artists" && (
            <ArtistsView
              query={query}
              onSelectArtist={openArtist}
              onBrowse={() => navigate({ kind: "library" })}
              onClearSearch={() => setQuery("")}
            />
          )}

          {view.kind === "playlists" && (
            <PlaylistsView
              query={query}
              onOpen={(id) => setView({ kind: "playlist", id })}
              onCreate={() => setNewPlaylistOpen(true)}
              onClearSearch={() => setQuery("")}
            />
          )}

          {view.kind === "playlist" && (
            <PlaylistView
              playlistId={view.id}
              onBack={() => navigate({ kind: "playlists" })}
              onBrowse={() => navigate({ kind: "library" })}
              onArtistClick={openArtist}
              onAdd={setAddTrack}
            />
          )}

          {view.kind === "liked" && (
            <LikedView
              onBrowse={() => navigate({ kind: "library" })}
              onArtistClick={openArtist}
              onAdd={setAddTrack}
            />
          )}
        </main>
      </div>

      <PlayerBar onOpenQueue={() => setQueueOpen(true)} />
      <MobileNav
        view={view}
        onNavigate={navigate}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
      <Toasts />

      {dragging && (
        <div className="drop-veil" aria-hidden="true">
          <div className="drop-card">
            <span className="drop-icon">
              <FolderDown size={24} />
            </span>
            <strong>松开即可导入</strong>
            <span>支持 mp3、flac、m4a 等音频文件</span>
          </div>
        </div>
      )}

      {addTrack && (
        <AddToPlaylistDialog track={addTrack} onClose={() => setAddTrack(null)} />
      )}
      {newPlaylistOpen && (
        <NewPlaylistDialog
          trackIds={newPlaylistTracks}
          onClose={() => {
            setNewPlaylistOpen(false);
            setNewPlaylistTracks([]);
          }}
          onCreated={(id) => {
            setNewPlaylistOpen(false);
            setNewPlaylistTracks([]);
            setView({ kind: "playlist", id });
          }}
        />
      )}
      {pendingImport && (
        <DuplicateDialog
          matches={pendingImport.matches}
          onCancel={() => {
            setPendingImport(null);
            toast("已取消导入");
          }}
          onConfirm={(choices) =>
            runImport(pendingImport.files, pendingImport.folder, choices)
          }
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          trackCount={tracks.length}
          isNative={IS_NATIVE}
          importing={importing}
          onImportFolder={() => {
            setSettingsOpen(false);
            void importFromFolder();
          }}
          onImportFiles={() => {
            setSettingsOpen(false);
            fileInputRef.current?.click();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          importFromFiles(files);
        }}
      />
    </div>
  );
}

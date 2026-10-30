import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Pencil,
  Play,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import type { Track } from "../types";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { useVisibleTrackIds } from "../lib/visible";
import { toast } from "../lib/toast";
import { PlaylistCover } from "../components/Artwork";
import { ConfirmDialog } from "../components/Dialog";
import { EmptyPlaylist } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";

interface PlaylistViewProps {
  playlistId: string;
  onBack: () => void;
  onBrowse: () => void;
  onArtistClick: (artist: string) => void;
  onAdd: (track: Track) => void;
}

export function PlaylistView({
  playlistId,
  onBack,
  onBrowse,
  onArtistClick,
  onAdd,
}: PlaylistViewProps) {
  const playlist = useLibrary((state) =>
    state.playlists.find((item) => item.id === playlistId),
  );
  const allTracks = useLibrary((state) => state.tracks);
  const renamePlaylist = useLibrary((state) => state.renamePlaylist);
  const deletePlaylist = useLibrary((state) => state.deletePlaylist);
  const removeFromPlaylist = useLibrary((state) => state.removeFromPlaylist);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(playlist?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(playlist?.name ?? "");
  }, [playlist?.name]);

  const tracks = useMemo(() => {
    if (!playlist) return [];
    const byId = new Map(allTracks.map((track) => [track.id, track]));
    return playlist.trackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => Boolean(track));
  }, [playlist, allTracks]);

  useVisibleTrackIds(tracks);

  if (!playlist) {
    return (
      <div className="view">
        <p className="view-sub">这个歌单不存在了。</p>
        <button type="button" className="button" onClick={onBack}>
          返回歌单
        </button>
      </div>
    );
  }

  const playAll = () => {
    if (tracks.length === 0) return;
    usePlayer.getState().playOrder(tracks.map((track) => track.id));
  };

  const playShuffle = () => {
    if (tracks.length === 0) return;
    usePlayer.getState().playShuffle(tracks.map((track) => track.id));
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    renamePlaylist(playlist.id, draft);
    setEditing(false);
    toast("歌单名称已更新");
  };

  return (
    <div className="view">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        歌单
      </button>

      <header className="playlist-hero">
        <div className="playlist-hero-cover">
          <PlaylistCover
            seed={playlist.name}
            trackSeeds={tracks.map((track) => track.title)}
          />
        </div>
        <div className="playlist-hero-info">
          <p className="eyebrow">歌单</p>
          {editing ? (
            <form className="rename-form" onSubmit={saveName}>
              <input
                className="text-input rename-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={60}
                autoFocus
                onFocus={(event) => event.target.select()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setDraft(playlist.name);
                    setEditing(false);
                  }
                }}
                aria-label="歌单名称"
              />
              <button type="submit" className="icon-button" aria-label="保存名称">
                <Check size={17} />
              </button>
              <button
                type="button"
                className="icon-button is-quiet"
                onClick={() => {
                  setDraft(playlist.name);
                  setEditing(false);
                }}
                aria-label="取消改名"
              >
                <X size={17} />
              </button>
            </form>
          ) : (
            <div className="playlist-title-row">
              <h1>{playlist.name}</h1>
              <button
                type="button"
                className="icon-button is-quiet"
                onClick={() => setEditing(true)}
                aria-label="重命名歌单"
                title="重命名"
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
          <p className="view-sub">{tracks.length} 首歌</p>
          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={playAll}
              disabled={tracks.length === 0}
            >
              <Play size={15} fill="currentColor" />
              播放全部
            </button>
            <button
              type="button"
              className="button"
              onClick={playShuffle}
              disabled={tracks.length === 0}
            >
              <Shuffle size={15} />
              随机播放
            </button>
            <button
              type="button"
              className="icon-button danger-quiet"
              onClick={() => setConfirmDelete(true)}
              aria-label="删除歌单"
              title="删除歌单"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <EmptyPlaylist onBrowse={onBrowse} />
      ) : (
        <TrackList
          tracks={tracks}
          onArtistClick={onArtistClick}
          onAdd={onAdd}
          onRemove={(track) => {
            removeFromPlaylist(playlist.id, track.id);
            toast(`已从「${playlist.name}」移除`);
          }}
          removeLabel="从歌单移除"
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="删除这个歌单？"
          description={`「${playlist.name}」会被删除，歌曲文件不会受影响。`}
          confirmLabel="删除歌单"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deletePlaylist(playlist.id);
            setConfirmDelete(false);
            toast("歌单已删除");
            onBack();
          }}
        />
      )}
    </div>
  );
}

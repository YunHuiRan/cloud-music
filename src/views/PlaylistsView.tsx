import { useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { useLibrary } from "../lib/store";
import { normalizeQuery } from "../lib/format";
import { useFlip } from "../lib/flip";
import { useVisibleTrackIds } from "../lib/visible";
import { PlaylistCover } from "../components/Artwork";
import { EmptyFilter } from "../components/EmptyState";

interface PlaylistsViewProps {
  query: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onClearSearch: () => void;
}

export function PlaylistsView({
  query,
  onOpen,
  onCreate,
  onClearSearch,
}: PlaylistsViewProps) {
  const playlists = useLibrary((state) => state.playlists);
  const tracks = useLibrary((state) => state.tracks);
  const gridRef = useRef<HTMLDivElement>(null);
  useFlip(gridRef);
  useVisibleTrackIds([]);

  const coverSeeds = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track.title]));
    return new Map(
      playlists.map((playlist) => [
        playlist.id,
        playlist.trackIds
          .map((id) => byId.get(id))
          .filter((title): title is string => Boolean(title)),
      ]),
    );
  }, [playlists, tracks]);

  const filtered = useMemo(() => {
    const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return playlists;
    return playlists.filter((playlist) => {
      const name = normalizeQuery(playlist.name);
      return tokens.every((token) => name.includes(token));
    });
  }, [playlists, query]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">收藏</p>
          <h1>歌单</h1>
          <p className="view-sub">{playlists.length} 个歌单</p>
        </div>
        <button type="button" className="button button-primary" onClick={onCreate}>
          <Plus size={16} />
          新建歌单
        </button>
      </header>

      {playlists.length === 0 ? (
        <div className="playlist-grid" ref={gridRef}>
          <button type="button" className="new-playlist-card" onClick={onCreate}>
            <span className="new-playlist-icon">
              <Plus size={24} />
            </span>
            <strong>建立第一个歌单</strong>
            <small>把常听的歌收在一起</small>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyFilter onClear={onClearSearch} />
      ) : (
        <div className="playlist-grid" ref={gridRef}>
          {filtered.map((playlist) => (
            <button
              type="button"
              key={playlist.id}
              className="playlist-card"
              data-flip-id={`playlist:${playlist.id}`}
              onClick={() => onOpen(playlist.id)}
            >
              <PlaylistCover
                seed={playlist.name}
                trackSeeds={coverSeeds.get(playlist.id) ?? []}
                size={220}
              />
              <span className="playlist-card-text">
                <strong>{playlist.name}</strong>
                <small>{playlist.trackIds.length} 首歌</small>
              </span>
            </button>
          ))}
          <button type="button" className="new-playlist-card is-small" onClick={onCreate}>
            <span className="new-playlist-icon">
              <Plus size={20} />
            </span>
            <strong>新建歌单</strong>
          </button>
        </div>
      )}
    </div>
  );
}

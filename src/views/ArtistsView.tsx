import { useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useLibrary } from "../lib/store";
import { collectArtists } from "../lib/artists";
import { coverStyle, normalizeQuery } from "../lib/format";
import { useFlip } from "../lib/flip";
import { useVisibleTrackIds } from "../lib/visible";
import { EmptyArtists, EmptyFilter } from "../components/EmptyState";

interface ArtistsViewProps {
  query: string;
  onSelectArtist: (artist: string) => void;
  onBrowse: () => void;
  onClearSearch: () => void;
}

function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}

export function ArtistsView({
  query,
  onSelectArtist,
  onBrowse,
  onClearSearch,
}: ArtistsViewProps) {
  const tracks = useLibrary((state) => state.tracks);
  const artists = useMemo(() => collectArtists(tracks), [tracks]);
  const gridRef = useRef<HTMLDivElement>(null);
  useFlip(gridRef);
  useVisibleTrackIds([]);

  const filtered = useMemo(() => {
    const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return artists;
    return artists.filter((artist) => {
      const name = normalizeQuery(artist.name);
      return tokens.every((token) => name.includes(token));
    });
  }, [artists, query]);

  if (tracks.length === 0) {
    return (
      <div className="view">
        <header className="view-head">
          <div>
            <p className="eyebrow">分类</p>
            <h1>歌手</h1>
          </div>
        </header>
        <EmptyArtists onBrowse={onBrowse} />
      </div>
    );
  }

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">分类</p>
          <h1>歌手</h1>
          <p className="view-sub">
            {filtered.length === artists.length
              ? `${artists.length} 位`
              : `${filtered.length} / ${artists.length} 位`}
          </p>
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyFilter onClear={onClearSearch} />
      ) : (
        <div className="artist-grid" ref={gridRef}>
          {filtered.map((artist) => (
            <button
              type="button"
              key={artist.name}
              className="artist-card"
              data-flip-id={`artist:${artist.name}`}
              onClick={() => onSelectArtist(artist.name)}
            >
              <span className="artist-avatar" style={coverStyle(artist.name)}>
                {initialOf(artist.name)}
              </span>
              <span className="artist-card-text">
                <strong>{artist.name}</strong>
                <small>{artist.count} 首歌</small>
              </span>
              <ChevronRight size={16} className="artist-arrow" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

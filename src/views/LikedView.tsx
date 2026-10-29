import { useMemo } from "react";
import { Heart, Play } from "lucide-react";
import type { Track } from "../types";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { useVisibleTrackIds } from "../lib/visible";
import { EmptyLiked } from "../components/EmptyState";
import { TrackList } from "../components/TrackList";

interface LikedViewProps {
  onBrowse: () => void;
  onArtistClick: (artist: string) => void;
  onAdd: (track: Track) => void;
}

export function LikedView({ onBrowse, onArtistClick, onAdd }: LikedViewProps) {
  const liked = useLibrary((state) => state.liked);
  const tracks = useLibrary((state) => state.tracks);

  const likedTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return liked
      .map((id) => byId.get(id))
      .filter((track): track is Track => Boolean(track));
  }, [liked, tracks]);

  useVisibleTrackIds(likedTracks);

  const playAll = () => {
    if (likedTracks.length === 0) return;
    usePlayer.getState().playOrder(likedTracks.map((track) => track.id));
  };

  return (
    <div className="view">
      <header className="playlist-hero liked-hero">
        <div className="playlist-hero-cover liked-cover">
          <Heart size={52} strokeWidth={1.3} fill="currentColor" />
        </div>
        <div className="playlist-hero-info">
          <p className="eyebrow">收藏</p>
          <h1>我喜欢的</h1>
          <p className="view-sub">{likedTracks.length} 首歌</p>
          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={playAll}
              disabled={likedTracks.length === 0}
            >
              <Play size={15} fill="currentColor" />
              播放全部
            </button>
          </div>
        </div>
      </header>

      {likedTracks.length === 0 ? (
        <EmptyLiked onBrowse={onBrowse} />
      ) : (
        <TrackList
          tracks={likedTracks}
          onArtistClick={onArtistClick}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}

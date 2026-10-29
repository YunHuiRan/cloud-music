import { useEffect, useRef, useState } from "react";
import { Check, Heart, Pause, Play, Plus, X } from "lucide-react";
import type { Track } from "../types";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { useTrackDuration } from "../lib/duration";
import { useFlip } from "../lib/flip";
import { formatTime } from "../lib/format";
import { useVirtualRows } from "../lib/virtual";
import { Artwork } from "./Artwork";

interface TrackRowProps {
  track: Track;
  index: number;
  onPlay: (track: Track) => void;
  onArtistClick: (artist: string) => void;
  onAdd: (track: Track) => void;
  onRemove?: (track: Track) => void;
  selectable?: boolean;
  selected?: boolean;
  locating?: boolean;
  onSelect?: (track: Track) => void;
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`equalizer ${playing ? "is-playing" : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function TrackRow({
  track,
  index,
  onPlay,
  onArtistClick,
  onAdd,
  onRemove,
  selectable = false,
  selected = false,
  locating = false,
  onSelect,
}: TrackRowProps) {
  const isCurrent = usePlayer((state) => state.currentId === track.id);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const isLiked = useLibrary((state) => state.liked.includes(track.id));
  const toggleLike = useLibrary((state) => state.toggleLike);
  const { duration, ref } = useTrackDuration(track);

  return (
    <div
      ref={ref}
      className={`track-row ${isCurrent ? "is-current" : ""} ${
        selected ? "is-selected" : ""
      } ${locating ? "is-locating" : ""}`}
      data-flip-id={track.id}
      data-track-id={track.id}
      role="button"
      tabIndex={0}
      aria-label={
        selectable
          ? `${selected ? "取消选择" : "选择"} ${track.title}`
          : `播放 ${track.title}`
      }
      aria-pressed={selectable ? selected : undefined}
      onClick={() => (selectable ? onSelect?.(track) : onPlay(track))}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectable) onSelect?.(track);
          else onPlay(track);
        }
      }}
    >
      <div className="row-index" aria-hidden="true">
        {selectable ? (
          <span className={`row-check ${selected ? "is-checked" : ""}`}>
            {selected && <Check size={13} strokeWidth={3} />}
          </span>
        ) : isCurrent ? (
          <Equalizer playing={isPlaying} />
        ) : (
          <>
            <span className="index-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Play className="index-play" size={15} fill="currentColor" />
          </>
        )}
      </div>

      <div className="row-artwork">
        <Artwork seed={track.title} size={38} />
      </div>

      <div className="row-text">
        <div className="row-title">{track.title}</div>
        <div className="row-artists">
          {track.artists.map((artist, artistIndex) => (
            <span key={artist}>
              {artistIndex > 0 && <span className="artist-sep">&amp;</span>}
              <button
                type="button"
                className="artist-link"
                onClick={(event) => {
                  event.stopPropagation();
                  onArtistClick(artist);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                title={`查看 ${artist} 的所有歌曲`}
              >
                {artist}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="row-duration">{duration > 0 ? formatTime(duration) : "–"}</div>

      <div className="row-actions">
        <button
          type="button"
          className={`icon-button row-action ${isLiked ? "is-liked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleLike(track.id);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={isLiked ? "取消喜欢" : "喜欢这首歌"}
          title={isLiked ? "取消喜欢" : "喜欢"}
        >
          <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className="icon-button row-action"
          onClick={(event) => {
            event.stopPropagation();
            onAdd(track);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label="添加到歌单"
          title="添加到歌单"
        >
          <Plus size={17} />
        </button>
        {onRemove && (
          <button
            type="button"
            className="icon-button row-action"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(track);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label="从这个歌单移除"
            title="从歌单移除"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

interface TrackListProps {
  tracks: Track[];
  onArtistClick: (artist: string) => void;
  onAdd: (track: Track) => void;
  onRemove?: (track: Track) => void;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelect?: (track: Track) => void;
}

export function TrackList({
  tracks,
  onArtistClick,
  onAdd,
  onRemove,
  selectable,
  selectedIds,
  onSelect,
}: TrackListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtual = useVirtualRows(containerRef, tracks.length);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  useFlip(containerRef, "", !virtual.virtualized);

  useEffect(() => {
    const locate = (event: Event): void => {
      const id = (event as CustomEvent<string>).detail;
      const index = tracks.findIndex((track) => track.id === id);
      const container = containerRef.current;
      const scroller = container?.closest<HTMLElement>(".content");
      if (index < 0 || !container || !scroller) return;

      event.preventDefault();
      const containerRect = container.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const head = container.querySelector<HTMLElement>(".track-head");
      const paddingTop = Number.parseFloat(getComputedStyle(container).paddingTop) || 0;
      const rowsTop =
        containerRect.top -
        scrollerRect.top +
        scroller.scrollTop +
        paddingTop +
        (head?.getBoundingClientRect().height ?? 0);
      const target =
        rowsTop +
        index * virtual.rowHeight -
        scroller.clientHeight / 2 +
        virtual.rowHeight / 2;
      scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      setLocatingId(id);
    };
    window.addEventListener("shiyin:locate-track", locate);
    return () => window.removeEventListener("shiyin:locate-track", locate);
  }, [tracks, virtual.rowHeight]);

  useEffect(() => {
    if (!locatingId) return;
    const timer = window.setTimeout(() => setLocatingId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [locatingId]);

  const handlePlay = (track: Track): void => {
    usePlayer.getState().playTracks(
      tracks.map((item) => item.id),
      track.id,
    );
  };

  const visible = tracks.slice(virtual.start, virtual.end);

  return (
    <div className={`track-list ${onRemove ? "has-remove" : ""}`} ref={containerRef}>
      <div className="track-head" aria-hidden="true">
        <span>#</span>
        <span>歌曲</span>
        <span className="track-head-duration">时长</span>
        <span />
      </div>
      {virtual.topPadding > 0 && (
        <div className="track-spacer" style={{ height: virtual.topPadding }} aria-hidden="true" />
      )}
      {visible.map((track, offset) => (
        <TrackRow
          key={track.id}
          track={track}
          index={virtual.start + offset}
          onPlay={handlePlay}
          onArtistClick={onArtistClick}
          onAdd={onAdd}
          onRemove={onRemove}
          selectable={selectable}
          selected={selectedIds?.has(track.id)}
          locating={track.id === locatingId}
          onSelect={onSelect}
        />
      ))}
      {virtual.bottomPadding > 0 && (
        <div
          className="track-spacer"
          style={{ height: virtual.bottomPadding }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function PlayPauseGlyph({ playing }: { playing: boolean }) {
  return playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />;
}

import { useEffect, useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { ArtistSummary } from "../lib/artists";

interface ArtistChipsProps {
  artists: ArtistSummary[];
  selected: string[];
  onToggle: (artist: string) => void;
  onClear: () => void;
  onOpenArtists: () => void;
}

export function ArtistChips({
  artists,
  selected,
  onToggle,
  onClear,
  onOpenArtists,
}: ArtistChipsProps) {
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected.length === 0) return;
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [selected.join("\u0000")]);

  const ordered = useMemo(() => {
    return [...artists].sort((a, b) => {
      const ai = selected.indexOf(a.name);
      const bi = selected.indexOf(b.name);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return 0;
    });
  }, [artists, selected]);

  if (artists.length === 0) return null;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      down: true,
      startX: event.clientX,
      startLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.down) return;
    const delta = event.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(delta) < 4) return;
    drag.current.moved = true;
    event.currentTarget.scrollLeft = drag.current.startLeft - delta;
  };

  const endDrag = () => {
    drag.current.down = false;
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  };

  return (
    <div className="chips-row">
      <div
        ref={scrollRef}
        className="chips-scroll"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        <button
          type="button"
          className={`chip ${selected.length === 0 ? "is-active" : ""}`}
          onClick={onClear}
        >
          全部
        </button>
        {ordered.map((artist) => {
          const active = selected.includes(artist.name);
          return (
            <button
              type="button"
              key={artist.name}
              className={`chip ${active ? "is-active" : ""}`}
              onClick={() => onToggle(artist.name)}
              title={`${artist.name} · ${artist.count} 首`}
            >
              <span>{artist.name}</span>
              <small>{artist.count}</small>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="chips-more"
        onClick={onOpenArtists}
        title="打开歌手页"
      >
        全部歌手
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

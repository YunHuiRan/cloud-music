import { ListMusic } from "lucide-react";
import { coverStyle, hashString } from "../lib/format";

interface ArtworkProps {
  seed: string;
  size?: number;
  kind?: "track" | "playlist";
  className?: string;
}

export function Artwork({
  seed,
  size = 48,
  kind = "track",
  className = "",
}: ArtworkProps) {
  const mark =
    seed
      .replace(/^[\s[【（(]+/u, "")
      .trim()
      .charAt(0)
      .toUpperCase() || "♪";

  return (
    <div
      className={`artwork ${className}`}
      style={{
        ...coverStyle(seed),
        width: size,
        height: size,
        flexBasis: size,
      }}
      aria-hidden="true"
    >
      <span className="artwork-groove" />
      {kind === "playlist" ? (
        <ListMusic size={Math.max(16, Math.round(size * 0.34))} strokeWidth={1.5} />
      ) : (
        <span
          className="artwork-letter"
          style={{ fontSize: Math.max(13, Math.round(size * 0.34)) }}
        >
          {mark}
        </span>
      )}
    </div>
  );
}

interface PlaylistCoverProps {
  seed: string;
  trackSeeds: string[];
  size?: number;
}

export function PlaylistCover({ seed, trackSeeds, size = 160 }: PlaylistCoverProps) {
  const colors = trackSeeds.slice(0, 4);
  return (
    <div
      className="playlist-cover"
      style={{ width: "100%", aspectRatio: "1 / 1", maxWidth: size }}
      aria-hidden="true"
    >
      {colors.length > 0 ? (
        <div className={`playlist-mosaic mosaic-${colors.length}`}>
          {Array.from({ length: Math.min(4, Math.max(1, colors.length)) }).map(
            (_, index) => {
              const source = colors[index % colors.length] ?? seed;
              return (
                <span
                  key={`${source}-${index}`}
                  style={coverStyle(source)}
                  className="mosaic-cell"
                />
              );
            },
          )}
        </div>
      ) : (
        <div className="playlist-empty-cover" style={coverStyle(seed)}>
          <ListMusic size={Math.round(size * 0.25)} strokeWidth={1.4} />
        </div>
      )}
      <span
        className="playlist-cover-tint"
        style={{ opacity: 0.12 + (hashString(seed) % 5) / 50 }}
      />
      {colors.length === 1 && (
        <span className="playlist-cover-mark">
          <ListMusic
            size={Math.round(size * 0.24)}
            strokeWidth={1.4}
          />
        </span>
      )}
    </div>
  );
}

import type { Track } from "../types";
import { compareArtists } from "./parser";

export interface ArtistSummary {
  name: string;
  count: number;
}

export function collectArtists(tracks: Track[]): ArtistSummary[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    for (const artist of track.artists) {
      counts.set(artist, (counts.get(artist) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || compareArtists(a.name, b.name),
  );
}

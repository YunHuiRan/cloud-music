import type { ScannedTrack, Track } from "../types";
import { trackFromScanned } from "./platform";

export interface DuplicateMatch {
  incoming: ScannedTrack;
  existing: Track;
  score: number;
  sameTitle: boolean;
  sharedArtist: boolean;
}

export type DuplicateChoice = "existing" | "incoming" | "both";

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    )
    .replace(/\b(feat|ft|featuring)\.?\s+[^)]*$/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function coreTitle(title: string): string {
  return normalize(
    title
      .replace(/\s*[（(][^）)]*(feat|ft|remix|version|ver\.?)[^）)]*[）)]/gi, "")
      .replace(/\s*[（(][^）)]*[）)]/g, "")
      .replace(/\s*\[[^\]]*\]/g, ""),
  );
}

function bigrams(text: string): string[] {
  if (text.length < 2) return [text];
  return Array.from({ length: text.length - 1 }, (_, index) =>
    text.slice(index, index + 2),
  );
}

function similarity(
  a: string,
  b: string,
  left: string[] = bigrams(a),
  right: string[] = bigrams(b),
): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return 0.85 + (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 0.1;
  }
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.55) {
    return 0;
  }
  const counts = new Map<string, number>();
  left.forEach((gram) => counts.set(gram, (counts.get(gram) ?? 0) + 1));
  let overlap = 0;
  right.forEach((gram) => {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  });
  return (2 * overlap) / (left.length + right.length);
}

interface ExistingEntry {
  track: Track;
  title: string;
  core: string;
  grams: string[];
  artists: Set<string>;
}

function addToIndex(
  index: Map<string, ExistingEntry[]>,
  key: string,
  entry: ExistingEntry,
): void {
  if (!key) return;
  const bucket = index.get(key);
  if (bucket) bucket.push(entry);
  else index.set(key, [entry]);
}

function addCandidates(
  target: Map<string, ExistingEntry>,
  bucket: ExistingEntry[] | undefined,
): void {
  if (!bucket) return;
  for (const entry of bucket) target.set(entry.track.id, entry);
}

function buildIndex(entries: ExistingEntry[]): Map<string, ExistingEntry[]> {
  const index = new Map<string, ExistingEntry[]>();
  for (const entry of entries) {
    addToIndex(index, `t:${entry.title}`, entry);
    addToIndex(index, `c:${entry.core}`, entry);
  }
  return index;
}

export function findDuplicateMatches(
  existingTracks: Track[],
  incoming: ScannedTrack[],
): DuplicateMatch[] {
  const existingIds = new Set(existingTracks.map((track) => track.id));
  const existingTitles: ExistingEntry[] = existingTracks.map((track) => {
    const core = coreTitle(track.title);
    return {
      track,
      title: normalize(track.title),
      core,
      grams: bigrams(core),
      artists: new Set(track.artists.map(normalize)),
    };
  });
  // Small libraries are cheap to compare exhaustively. For larger ones, use
  // title/core/artist buckets so importing does not become O(n * m).
  const useIndex = existingTitles.length > 500;
  const index = useIndex ? buildIndex(existingTitles) : null;

  const matches: DuplicateMatch[] = [];
  for (const file of incoming) {
    if (existingIds.has(file.id)) continue;
    const parsed = trackFromScanned(file);
    const core = coreTitle(parsed.title);
    const title = normalize(parsed.title);
    const artists = new Set(parsed.artists.map(normalize));

    let candidates: ExistingEntry[] = existingTitles;
    if (index) {
      const found = new Map<string, ExistingEntry>();
      // Exact normalized title/core buckets only. Prefix/artist buckets can
      // contain thousands of entries in large libraries, which turns a fast
      // import into an accidental O(n * m) scan. Small libraries still use
      // the exhaustive fuzzy comparison below.
      addCandidates(found, index.get(`t:${title}`));
      addCandidates(found, index.get(`c:${core}`));
      candidates = Array.from(found.values());
    }

    const incomingGrams = bigrams(core);
    let best: DuplicateMatch | null = null;
    for (const candidate of candidates) {
      const sharedArtist = [...artists].some(
        (artist) =>
          artist.length > 0 &&
          [...candidate.artists].some(
            (other) => other === artist || other.includes(artist) || artist.includes(other),
          ),
      );
      let score = 0;
      let sameTitle = false;
      if (title && title === candidate.title) {
        score = 1;
        sameTitle = true;
      } else if (core && core === candidate.core) {
        score = 0.94;
        sameTitle = true;
      } else {
        const titleScore = similarity(
          core,
          candidate.core,
          incomingGrams,
          candidate.grams,
        );
        if (sharedArtist && titleScore >= 0.8) score = 0.6 + titleScore * 0.3;
        else if (titleScore >= 0.92) score = 0.7;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = {
          incoming: file,
          existing: candidate.track,
          score,
          sameTitle,
          sharedArtist,
        };
      }
    }
    if (best) matches.push(best);
  }
  return matches;
}

export const AUDIO_EXTENSIONS = [
  "mp3",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "wave",
  "webm",
  "aiff",
  "aif",
  "wma",
  "mka",
  "m4b",
] as const;

const AUDIO_EXTENSION = new RegExp(
  `\\.(${AUDIO_EXTENSIONS.join("|")})$`,
  "i",
);

export const UNKNOWN_ARTIST = "未知艺术家";

export interface ParsedName {
  title: string;
  artists: string[];
}

export function isAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSION.test(fileName);
}

export function stripAudioExtension(fileName: string): string {
  return fileName.replace(AUDIO_EXTENSION, "");
}

/**
 * Files are named `歌曲名—歌手1&歌手2&歌手3.ext`.
 * The *last* separator is used so titles and artist names may contain hyphens.
 * Legacy ` - `, ` – ` and `－` separators are still accepted.
 */
export function parseTrackName(fileName: string): ParsedName {
  const base = stripAudioExtension(fileName)
    .normalize("NFC")
    .replace(/[\u00a0\u3000]/g, " ")
    .trim();

  let splitAt = -1;
  let delimiterWidth = 0;

  const findLast = (pattern: RegExp) => {
    let foundAt = -1;
    let width = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(base)) !== null) {
      foundAt = match.index;
      width = match[0].length;
    }
    return { foundAt, width };
  };

  // Prefer the official em dash. It is unambiguous even when the artist name
  // contains a hyphen (for example "A-Lin"). Legacy names keep the old
  // spaced-separator preference so hyphenated artists still parse correctly.
  let found = findLast(/\s*—\s*/g);
  if (found.foundAt < 0) {
    found = findLast(/\s+[-–－]\s+/g);
  }
  if (found.foundAt < 0) {
    found = findLast(/\s*[-–－]\s*/g);
  }
  splitAt = found.foundAt;
  delimiterWidth = found.width;

  let title = base;
  let artistPart = "";
  if (splitAt > 0 && splitAt < base.length - delimiterWidth) {
    const candidate = base.slice(splitAt + delimiterWidth).trim();
    if (/[^\s\-–—－]/.test(candidate)) {
      title = base.slice(0, splitAt).trim();
      artistPart = candidate;
    }
  }

  const artists: string[] = [];
  const seen = new Set<string>();
  for (const raw of artistPart.split(/[&＆]/)) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    artists.push(name);
  }

  return {
    title: title || base || "未命名歌曲",
    artists: artists.length > 0 ? artists : [UNKNOWN_ARTIST],
  };
}

export function compareArtists(a: string, b: string): number {
  return new Intl.Collator("zh-Hans", {
    numeric: true,
    sensitivity: "base",
  }).compare(a, b);
}

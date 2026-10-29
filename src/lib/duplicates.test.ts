import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ScannedTrack, Track } from "../types";

vi.stubGlobal("window", {});

let findDuplicateMatches: typeof import("./duplicates").findDuplicateMatches;

beforeAll(async () => {
  ({ findDuplicateMatches } = await import("./duplicates"));
});

function track(id: string, title: string, artist: string): Track {
  return {
    id,
    path: `C:\\music\\${id}.mp3`,
    fileName: `${title} - ${artist}.mp3`,
    relativePath: `${title} - ${artist}.mp3`,
    size: 100,
    addedAt: 1,
    title,
    artists: [artist],
  };
}

function scanned(id: string, title: string, artist: string): ScannedTrack {
  return {
    id,
    path: `C:\\incoming\\${id}.mp3`,
    fileName: `${title} - ${artist}.mp3`,
    relativePath: `${title} - ${artist}.mp3`,
    size: 100,
  };
}

describe("findDuplicateMatches", () => {
  it("matches identical titles and artists", () => {
    const matches = findDuplicateMatches(
      [track("existing", "Lemon", "米津玄師")],
      [scanned("incoming", "Lemon", "米津玄師")],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(1);
  });

  it("folds katakana and hiragana", () => {
    const matches = findDuplicateMatches(
      [track("existing", "レモン", "米津玄師")],
      [scanned("incoming", "れもん", "米津玄師")],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(1);
  });

  it("matches a bracketed feature credit to the core title", () => {
    const matches = findDuplicateMatches(
      [track("existing", "夜に駆ける", "YOASOBI")],
      [scanned("incoming", "夜に駆ける (feat. 幾田りら)", "YOASOBI")],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(0.94);
  });

  it("flags the same title by different artists so both can be kept", () => {
    const matches = findDuplicateMatches(
      [track("existing", "Lemon", "米津玄師")],
      [scanned("incoming", "Lemon", "另一位歌手")],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].sameTitle).toBe(true);
    expect(matches[0].sharedArtist).toBe(false);
  });

  it("does not match unrelated songs", () => {
    const matches = findDuplicateMatches(
      [track("existing", "Lemon", "米津玄師")],
      [scanned("incoming", "夜行列车", "陈默")],
    );
    expect(matches).toHaveLength(0);
  });
});

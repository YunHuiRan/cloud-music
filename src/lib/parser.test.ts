import { describe, expect, it } from "vitest";
import {
  compareArtists,
  isAudioFile,
  parseTrackName,
  stripAudioExtension,
  UNKNOWN_ARTIST,
} from "./parser";

describe("parseTrackName", () => {
  it("splits a title and several artists", () => {
    expect(parseTrackName("潮汐来信 - 海边的房间 & 林间电台.wav")).toEqual({
      title: "潮汐来信",
      artists: ["海边的房间", "林间电台"],
    });
  });

  it("parses the official em-dash and ampersand format", () => {
    expect(parseTrackName("歌曲名—歌手1&歌手2&歌手3.mp3")).toEqual({
      title: "歌曲名",
      artists: ["歌手1", "歌手2", "歌手3"],
    });
  });

  it("keeps spaced hyphens in a title before the em-dash separator", () => {
    expect(parseTrackName("Love - Story—A-Lin&June.flac")).toEqual({
      title: "Love - Story",
      artists: ["A-Lin", "June"],
    });
  });

  it("accepts files without spaces around the separator", () => {
    expect(parseTrackName("Afterglow-Nova&林间电台.flac")).toEqual({
      title: "Afterglow",
      artists: ["Nova", "林间电台"],
    });
  });

  it("accepts full-width ampersands and dashes", () => {
    expect(parseTrackName("夜行列车－北纬三十度＆陈默.mp3")).toEqual({
      title: "夜行列车",
      artists: ["北纬三十度", "陈默"],
    });
  });

  it("keeps hyphens inside the title", () => {
    expect(parseTrackName("Love-Story - A-Lin & June.mp3")).toEqual({
      title: "Love-Story",
      artists: ["A-Lin", "June"],
    });
  });

  it("deduplicates artists regardless of case", () => {
    expect(parseTrackName("Song - Nova & nova & JUNE.mp3").artists).toEqual([
      "Nova",
      "JUNE",
    ]);
  });

  it("does not leave empty artists", () => {
    expect(parseTrackName("Song - Nova && & June.mp3").artists).toEqual([
      "Nova",
      "June",
    ]);
  });

  it("falls back to an unknown artist", () => {
    expect(parseTrackName("Just a title.mp3")).toEqual({
      title: "Just a title",
      artists: [UNKNOWN_ARTIST],
    });
  });

  it("keeps a title that only contains a dash", () => {
    expect(parseTrackName("- - - .mp3")).toEqual({
      title: "- - -",
      artists: [UNKNOWN_ARTIST],
    });
  });
});

describe("file names", () => {
  it("recognizes supported audio extensions case-insensitively", () => {
    expect(isAudioFile("TRACK.FLAC")).toBe(true);
    expect(isAudioFile("track.m4a")).toBe(true);
    expect(isAudioFile("cover.jpg")).toBe(false);
  });

  it("strips only the final audio extension", () => {
    expect(stripAudioExtension("song.mp3.flac")).toBe("song.mp3");
  });
});

describe("compareArtists", () => {
  it("sorts Chinese names with the locale collator", () => {
    const names = ["Nova", "陈默", "林间电台", "June"];
    expect(names.sort(compareArtists)).toEqual(["陈默", "林间电台", "June", "Nova"]);
  });
});

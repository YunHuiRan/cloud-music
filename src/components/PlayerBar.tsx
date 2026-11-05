import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  MonitorSpeaker,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  LocateGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  QueueGlyph,
} from "./TransportGlyphs";
import { ModeButtons } from "./ModeButtons";
import { useLiquidSurface } from "./useLiquidSurface";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { isAndroidApp } from "../lib/android-shell";
import { locateCurrent } from "../lib/locate";
import { toast } from "../lib/toast";

interface PlayerBarProps {
  onOpenQueue: () => void;
}

export function PlayerBar({ onOpenQueue }: PlayerBarProps) {
  const currentId = usePlayer((state) => state.currentId);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);
  const toggle = usePlayer((state) => state.toggle);
  const next = usePlayer((state) => state.next);
  const previous = usePlayer((state) => state.previous);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);
  const playShuffle = usePlayer((state) => state.playShuffle);
  const playOrder = usePlayer((state) => state.playOrder);
  const visibleIds = usePlayer((state) => state.visibleIds);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);
  const track = useLibrary((state) =>
    state.tracks.find((item) => item.id === currentId),
  );

  const sliderStyle = {
    "--volume": `${muted ? 0 : volume * 100}%`,
  } as CSSProperties;

  const android = isAndroidApp();
  const titleRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const [infoWidth, setInfoWidth] = useState<number>();
  const liquid = useLiquidSurface<HTMLDivElement>({ draggable: false });

  useLayoutEffect(() => {
    if (android) return;
    const titleWidth = titleRef.current?.getBoundingClientRect().width ?? 0;
    const artistsWidth = artistsRef.current?.getBoundingClientRect().width ?? 0;
    const measured = Math.max(titleWidth, artistsWidth) + 40;
    setInfoWidth(Math.max(120, Math.min(360, measured)));
  }, [android, track?.id, track?.title, track?.artists]);
  const startFromVisible = (mode: "shuffle" | "order") => {
    if (mode === "shuffle") playShuffle(visibleIds);
    else playOrder(visibleIds);
  };

  const repeatTitle =
    repeat === "off" ? "开启循环" : repeat === "all" ? "单曲循环" : "关闭循环";
  const activeMode = track ? (shuffle ? "shuffle" : "order") : null;

  return (
    <footer
      className={`player-bar ${track ? "has-track" : ""} ${
        android ? "is-android" : ""
      }`}
      style={{
        boxShadow: "none",
        marginLeft: `${android ? "0" : "2%"}`,
        marginRight: `${android ? "0" : "2%"}`,
      }}
    >
      <div className={`player-islands ${android ? "is-android" : ""}`}>
        {!android && (
          <div
            className="player-group player-info-group"
            style={infoWidth ? { width: `${infoWidth}px` } : undefined}
          >
            <div className="player-meta">
              <div className={`player-title ${track ? "" : "is-idle"}`}>
                <span ref={titleRef}>{track?.title ?? "未在播放"}</span>
              </div>
              <div className="player-artists">
                <span ref={artistsRef}>
                  {track ? track.artists.join(" & ") : "从曲库中挑一首吧"}
                </span>
              </div>
            </div>
          </div>
        )}
        <div
          ref={android ? liquid.ref : undefined}
          className={`player-group player-control-group ${
            android ? "liquid-surface" : ""
          } ${android && liquid.dragging ? "is-dragging" : ""}`}
          style={android ? liquid.style : undefined}
          {...(android ? liquid.handlers : {})}
        >
          {android && liquid.decor}
          <div className={`player-compact-info ${track ? "" : "is-idle"}`}>
            <strong>{track?.title ?? "未在播放"}</strong>
            <small>
              {track ? track.artists.join(" & ") : "从曲库中挑一首吧"}
            </small>
          </div>
          <ModeButtons
            activeMode={activeMode}
            onSelect={(mode) => startFromVisible(mode)}
          />
          <div className="transport">
            <button
              type="button"
              className="icon-button transport-skip"
              onClick={previous}
              disabled={!track}
              title="上一首"
              aria-label="上一首"
            >
              <PreviousGlyph size={22} />
            </button>
            <button
              type="button"
              className="play-button"
              onClick={toggle}
              disabled={!track}
              title={isPlaying ? "暂停" : "播放"}
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? (
                <PauseGlyph size={24} />
              ) : (
                <PlayGlyph size={24} className="play-offset" />
              )}
            </button>
            <button
              type="button"
              className="icon-button transport-skip"
              onClick={() => next()}
              disabled={!track}
              title="下一首"
              aria-label="下一首"
            >
              <NextGlyph size={22} />
            </button>
            {android && (
              <button
                type="button"
                className="icon-button transport-queue"
                onClick={onOpenQueue}
                title="播放队列"
                aria-label="播放队列"
              >
                <QueueGlyph size={21} />
              </button>
            )}
          </div>
        </div>
        {!android && (
          <div className="player-group player-tools-group">
            <button
              type="button"
              className="icon-button transport-queue"
              onClick={onOpenQueue}
              title="播放队列"
              aria-label="播放队列"
            >
              <QueueGlyph size={18} />
            </button>
            <button
              type="button"
              className="icon-button volume-button"
              onClick={toggleMute}
              title={muted ? "取消静音" : "静音"}
              aria-label={muted ? "取消静音" : "静音"}
            >
              {muted || volume === 0 ? (
                <VolumeX size={17} />
              ) : (
                <Volume2 size={17} />
              )}
            </button>
            <div className="volume-slider" style={sliderStyle}>
              <div className="range-track">
                <span className="range-played" />
              </div>
              <input
                type="range"
                className="range-input"
                min={0}
                max={100}
                step={1}
                value={muted ? 0 : Math.round(volume * 100)}
                onChange={(event) =>
                  setVolume(Number(event.target.value) / 100)
                }
                aria-label="音量"
              />
            </div>
            <button
              type="button"
              className="icon-button player-device"
              onClick={() => toast("当前播放设备：此电脑")}
              title="播放设备：此电脑"
              aria-label="播放设备：此电脑"
            >
              <MonitorSpeaker size={18} />
            </button>
            <button
              type="button"
              className="icon-button locate-button"
              onClick={() => locateCurrent(currentId)}
              title="定位正在播放的歌曲"
              aria-label="定位正在播放的歌曲"
              disabled={!track}
            >
              <LocateGlyph size={18} />
            </button>
            <button
              type="button"
              className={`icon-button repeat-button ${repeat !== "off" ? "is-active" : ""}`}
              onClick={cycleRepeat}
              title={repeatTitle}
              aria-label="切换循环模式"
            >
              {repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}

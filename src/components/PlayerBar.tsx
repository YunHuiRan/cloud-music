import type { CSSProperties } from "react";
import { Heart, ListMusic, Loader2, Repeat, Repeat1, Volume2, VolumeX } from "lucide-react";
import {
  LocateGlyph,
  NextGlyph,
  OrderGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  QueueGlyph,
  ShuffleGlyph,
} from "./TransportGlyphs";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { isAndroidApp } from "../lib/android-shell";
import { formatTime } from "../lib/format";
import { locateCurrent } from "../lib/locate";
import { Artwork } from "./Artwork";

interface PlayerBarProps {
  onOpenQueue: () => void;
}

export function PlayerBar({ onOpenQueue }: PlayerBarProps) {
  const currentId = usePlayer((state) => state.currentId);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const isLoading = usePlayer((state) => state.isLoading);
  const currentTime = usePlayer((state) => state.currentTime);
  const duration = usePlayer((state) => state.duration);
  const buffered = usePlayer((state) => state.buffered);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);
  const toggle = usePlayer((state) => state.toggle);
  const next = usePlayer((state) => state.next);
  const previous = usePlayer((state) => state.previous);
  const seekTo = usePlayer((state) => state.seekTo);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);
  const playShuffle = usePlayer((state) => state.playShuffle);
  const playOrder = usePlayer((state) => state.playOrder);
  const visibleIds = usePlayer((state) => state.visibleIds);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);
  const track = useLibrary((state) =>
    state.tracks.find((item) => item.id === currentId),
  );
  const liked = useLibrary((state) =>
    currentId ? state.liked.includes(currentId) : false,
  );
  const toggleLike = useLibrary((state) => state.toggleLike);

  const played = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const loaded = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const sliderStyle = {
    "--played": `${played}%`,
    "--loaded": `${loaded}%`,
    "--volume": `${muted ? 0 : volume * 100}%`,
  } as CSSProperties;

  const android = isAndroidApp();
  const startFromVisible = (mode: "shuffle" | "order") => {
    if (mode === "shuffle") playShuffle(visibleIds);
    else playOrder(visibleIds);
  };

  return (
    <footer
      className={`player-bar ${track ? "has-track" : ""} ${
        android ? "is-android" : ""
      }`}
    >
      <div className="player-track">
        {track ? (
          <>
            <Artwork seed={track.title} size={52} />
            <div className="player-meta">
              <div className="player-title">{track.title}</div>
              <div className="player-artists">{track.artists.join(" & ")}</div>
            </div>
            <button
              type="button"
              className={`icon-button player-like ${liked ? "is-liked" : ""}`}
              onClick={() => toggleLike(track.id)}
              aria-label={liked ? "取消喜欢" : "喜欢这首歌"}
              title={liked ? "取消喜欢" : "喜欢"}
            >
              <Heart size={17} fill={liked ? "currentColor" : "none"} />
            </button>
          </>
        ) : (
          <>
            <div className="player-artwork-placeholder">
              <ListMusic size={21} strokeWidth={1.5} />
            </div>
            <div className="player-meta">
              <div className="player-title is-idle">未在播放</div>
              <div className="player-artists">从曲库中挑一首吧</div>
            </div>
          </>
        )}
      </div>

      <div className="player-center">
        <div className="transport">
          <span className="transport-spacer" aria-hidden="true" />
          {android && (
            <button
              type="button"
              className="icon-button transport-locate"
              onClick={() => locateCurrent(currentId)}
              disabled={!track}
              title="定位正在播放的歌曲"
              aria-label="定位正在播放的歌曲"
            >
              <LocateGlyph size={23} />
            </button>
          )}
          <button
            type="button"
            className={`icon-button transport-small transport-mode ${
              shuffle ? "is-active" : ""
            }`}
            onClick={() => startFromVisible("shuffle")}
            title="随机播放当前列表"
            aria-label="随机播放当前列表"
            aria-pressed={shuffle}
          >
            <ShuffleGlyph size={21} />
          </button>
          <button
            type="button"
            className="icon-button transport-skip"
            onClick={previous}
            disabled={!track}
            title="上一首"
            aria-label="上一首"
          >
            <PreviousGlyph size={23} />
          </button>
          <button
            type="button"
            className="play-button"
            onClick={toggle}
            disabled={!track}
            title={isPlaying ? "暂停" : "播放"}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isLoading ? (
              <Loader2 size={26} className="spin" />
            ) : isPlaying ? (
              <PauseGlyph size={26} />
            ) : (
              <PlayGlyph size={26} className="play-offset" />
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
            <NextGlyph size={23} />
          </button>
          <button
            type="button"
            className={`icon-button transport-small transport-mode ${
              !shuffle ? "is-active" : ""
            }`}
            onClick={() => startFromVisible("order")}
            title="顺序播放当前列表"
            aria-label="顺序播放当前列表"
            aria-pressed={!shuffle}
          >
            <OrderGlyph size={21} />
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
          <button
            type="button"
            className={`icon-button transport-small transport-repeat ${
              repeat !== "off" ? "is-active" : ""
            }`}
            onClick={cycleRepeat}
            title={
              repeat === "off"
                ? "开启循环"
                : repeat === "all"
                  ? "单曲循环"
                  : "关闭循环"
            }
            aria-label="切换循环模式"
          >
            {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        <div className="timeline" style={sliderStyle}>
          <span className="time-label">{formatTime(currentTime)}</span>
          <div className="range-wrap">
            <div className="range-track">
              <span className="range-loaded" />
              <span className="range-played" />
            </div>
            <input
              type="range"
              className="range-input"
              min={0}
              max={Math.max(1, duration)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.target.value))}
              disabled={!track || duration <= 0}
              aria-label="播放进度"
            />
          </div>
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-side">
        <button
          type="button"
          className="icon-button volume-button"
          onClick={toggleMute}
          title={muted ? "取消静音" : "静音"}
          aria-label={muted ? "取消静音" : "静音"}
        >
          {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
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
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            aria-label="音量"
          />
        </div>
        <button
          type="button"
          className="icon-button locate-button"
          onClick={() => locateCurrent(currentId)}
          title="定位正在播放的歌曲"
          aria-label="定位正在播放的歌曲"
          disabled={!track}
        >
          <LocateGlyph size={19} />
        </button>
        <button
          type="button"
          className="icon-button queue-button"
          onClick={onOpenQueue}
          title="播放队列"
          aria-label="播放队列"
        >
          <QueueGlyph size={22} />
        </button>
      </div>
    </footer>
  );
}

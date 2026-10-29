import { useMemo, useRef } from "react";
import { ListMusic, Trash2, X } from "lucide-react";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { useFlip } from "../lib/flip";
import { Artwork } from "./Artwork";

interface QueueDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function QueueDrawer({ open, onClose }: QueueDrawerProps) {
  const queue = usePlayer((state) => state.queue);
  const currentId = usePlayer((state) => state.currentId);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const clearQueue = usePlayer((state) => state.clearQueue);
  const tracks = useLibrary((state) => state.tracks);
  const bodyRef = useRef<HTMLDivElement>(null);
  useFlip(bodyRef);

  const entries = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return queue
      .map((id, index) => ({ track: byId.get(id), index }))
      .filter((entry): entry is { track: NonNullable<typeof entry.track>; index: number } =>
        Boolean(entry.track),
      );
  }, [queue, tracks]);

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`queue-drawer ${open ? "is-open" : ""}`}
        aria-label="播放队列"
        aria-hidden={!open}
      >
        <div className="queue-head">
          <div>
            <p className="eyebrow">接下来播放</p>
            <h2>播放队列</h2>
          </div>
          <div className="queue-head-actions">
            {queue.length > 0 && (
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  clearQueue();
                  onClose();
                }}
                title="清空队列"
                aria-label="清空队列"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              title="关闭队列"
              aria-label="关闭队列"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="queue-body" ref={bodyRef}>
          {entries.length === 0 ? (
            <div className="queue-empty">
              <ListMusic size={26} strokeWidth={1.5} />
              <p>队列是空的</p>
              <small>播放一首歌后，接下来的歌曲会出现在这里。</small>
            </div>
          ) : (
            entries.map(({ track, index }) => {
              const active = track.id === currentId;
              return (
                <button
                  type="button"
                  key={track.id}
                  className={`queue-row ${active ? "is-current" : ""}`}
                  data-flip-id={`queue:${track.id}`}
                  onClick={() => usePlayer.getState().playAt(index)}
                >
                  <span className="queue-index">
                    {active ? (
                      <span className={`mini-bars ${isPlaying ? "is-playing" : ""}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <Artwork seed={track.title} size={36} />
                  <span className="queue-text">
                    <strong>{track.title}</strong>
                    <small>{track.artists.join(" & ")}</small>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {entries.length > 0 && (
          <div className="queue-foot">
            <span>{entries.length} 首歌</span>
            <span className="queue-shortcut">Esc 关闭</span>
          </div>
        )}
      </aside>
    </>
  );
}

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Heart, ListPlus, Trash2, X } from "lucide-react";
import type { Track } from "../types";
import { Artwork } from "./Artwork";

interface TrackActionSheetProps {
  track: Track;
  liked: boolean;
  onClose: () => void;
  onToggleLike: () => void;
  onAdd: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackActionSheet({
  track,
  liked,
  onClose,
  onToggleLike,
  onAdd,
  onRemove,
  removeLabel = "移除",
}: TrackActionSheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onBack = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("shiyin:android-back", onBack, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("shiyin:android-back", onBack, true);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const action = (run: () => void) => {
    run();
    onClose();
  };

  return createPortal(
    <div
      className="action-sheet-overlay"
      data-modal-open
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label="歌曲操作">
        <span className="action-sheet-grabber" aria-hidden="true" />
        <div className="action-sheet-head">
          <div className="action-sheet-track">
            <Artwork seed={track.title} size={44} />
            <div>
              <div className="action-sheet-title">{track.title}</div>
              <div className="action-sheet-artists">{track.artists.join(" & ")}</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-button is-quiet"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="action-sheet-actions">
          <button
            type="button"
            className={`action-sheet-item ${liked ? "is-liked" : ""}`}
            onClick={() => action(onToggleLike)}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
            <span>{liked ? "取消喜欢" : "喜欢这首歌"}</span>
          </button>
          <button type="button" className="action-sheet-item" onClick={() => action(onAdd)}>
            <ListPlus size={20} />
            <span>添加到歌单</span>
          </button>
          {onRemove && (
            <button
              type="button"
              className="action-sheet-item is-danger"
              onClick={() => action(onRemove)}
            >
              <Trash2 size={20} />
              <span>{removeLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

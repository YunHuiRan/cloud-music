import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListPlus, Trash2 } from "lucide-react";
import type { Track } from "../types";

interface TrackMenuProps {
  track: Track;
  anchor: HTMLElement | null;
  onClose: () => void;
  onAdd: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackMenu({
  track,
  anchor,
  onClose,
  onAdd,
  onRemove,
  removeLabel = "移除",
}: TrackMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!anchor) return;
    const width = 212;
    const height = 174;
    const margin = 10;
    const rect = anchor.getBoundingClientRect();
    let left = rect.right - width;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - margin) top = rect.top - height - 6;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, top);
    setPosition({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    const onScroll = (): void => onClose();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="track-menu"
      role="menu"
      aria-label={`${track.title} 的操作`}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="track-menu-head">
        <strong>{track.title}</strong>
        <small>{track.artists.join(" & ")}</small>
      </div>
      <button
        type="button"
        role="menuitem"
        className="track-menu-item"
        onClick={() => {
          onAdd();
          onClose();
        }}
      >
        <ListPlus size={17} />
        <span>添加到歌单</span>
      </button>
      {onRemove && (
        <button
          type="button"
          role="menuitem"
          className="track-menu-item is-danger"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          <Trash2 size={16} />
          <span>{removeLabel}</span>
        </button>
      )}
    </div>,
    document.body,
  );
}

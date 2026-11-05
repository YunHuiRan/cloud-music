import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AudioLines,
  Copy,
  Minus,
  Moon,
  Search,
  Square,
  Sun,
  X,
} from "lucide-react";
import type { Theme } from "../types";
import { isAndroidApp } from "../lib/android-shell";
import { nativeBridge } from "../lib/platform";
import { formatBinding, useSettings } from "../lib/settings";

interface TopbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Topbar({
  query,
  onQueryChange,
  theme,
  onToggleTheme,
}: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [compact, setCompact] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const draggingRef = useRef(false);
  const searchShortcut = useSettings((state) => state.shortcuts.search);
  const isElectron = nativeBridge?.platform === "electron";
  const isAndroid = isAndroidApp();
  const compactSearch = compact && !isAndroid;

  useEffect(() => {
    if (isAndroid) return;
    const media = window.matchMedia("(max-width: 1199px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [isAndroid]);

  useEffect(() => {
    const focusSearch = () => {
      setExpanded(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("shiyin:focus-search", focusSearch);
    return () => window.removeEventListener("shiyin:focus-search", focusSearch);
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    let active = true;
    void nativeBridge?.isWindowMaximized?.().then((value) => {
      if (active) setMaximized(value);
    });
    const unsubscribe = nativeBridge?.onWindowMaximized?.((value) => {
      setMaximized(value);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron) return;
    const endDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      void nativeBridge?.endWindowDrag?.();
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
      endDrag();
    };
  }, [isElectron]);

  useEffect(() => {
    if (!expanded) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const canStartWindowDrag = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    return !element?.closest(
      "button, input, .search-field, .window-controls, .topbar-actions",
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      !isElectron ||
      event.button !== 0 ||
      !canStartWindowDrag(event.target)
    ) {
      return;
    }
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    void nativeBridge?.startWindowDrag?.();
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    void nativeBridge?.endWindowDrag?.();
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isElectron || !canStartWindowDrag(event.target)) return;
    void nativeBridge?.windowControl?.("toggle-maximize");
  };

  return (
    <header
      className={`topbar ${compactSearch ? "is-compact-search" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {compactSearch && (
        <div className="topbar-brand" aria-label="Cloud Music">
          <span className="topbar-brand-mark">
            <AudioLines size={16} strokeWidth={2} />
          </span>
          <strong>Cloud Music</strong>
        </div>
      )}

      {compactSearch && !expanded ? (
        <button
          type="button"
          className="search-collapsed"
          onClick={() => setExpanded(true)}
          aria-label="展开搜索"
          title="搜索歌曲或歌手"
        >
          <Search size={19} />
          <kbd>{formatBinding(searchShortcut)}</kbd>
        </button>
      ) : (
        <div className={`search-field ${expanded ? "is-expanded" : ""}`}>
          <Search size={17} className="search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            data-search-input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => setExpanded(true)}
            onBlur={() => {
              if (!query) setExpanded(false);
            }}
            placeholder="搜索歌曲或歌手"
            aria-label="搜索歌曲或歌手"
            aria-keyshortcuts={searchShortcut}
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                onQueryChange("");
                inputRef.current?.focus();
              }}
              aria-label="清除搜索"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="search-kbd">{formatBinding(searchShortcut)}</kbd>
          )}
        </div>
      )}

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button theme-button"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
          title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {isElectron && (
          <div className="window-controls" aria-label="窗口控制">
            <button
              type="button"
              className="window-control"
              onClick={() => void nativeBridge?.windowControl?.("minimize")}
              aria-label="最小化"
              title="最小化"
            >
              <Minus size={15} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="window-control"
              onClick={() =>
                void nativeBridge?.windowControl?.("toggle-maximize")
              }
              aria-label={maximized ? "还原窗口" : "最大化"}
              title={maximized ? "还原窗口" : "最大化"}
            >
              {maximized ? (
                <Copy size={13} strokeWidth={1.8} />
              ) : (
                <Square size={12} strokeWidth={1.8} />
              )}
            </button>
            <button
              type="button"
              className="window-control is-close"
              onClick={() => void nativeBridge?.windowControl?.("close")}
              aria-label="关闭"
              title="关闭"
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

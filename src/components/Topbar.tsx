import { useEffect, useRef, useState } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import type { Theme } from "../types";
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
  const searchShortcut = useSettings((state) => state.shortcuts.search);

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

  return (
    <header className="topbar">
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

      <button
        type="button"
        className="icon-button theme-button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

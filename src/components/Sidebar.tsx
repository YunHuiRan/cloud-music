import type { ReactNode } from "react";
import {
  AudioLines,
  FolderPlus,
  Heart,
  ListMusic,
  Loader2,
  Music2,
  Plus,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { Playlist, View } from "../types";
import { formatCount } from "../lib/format";

interface SidebarProps {
  view: View;
  playlists: Playlist[];
  onNavigate: (view: View) => void;
  onCreatePlaylist: () => void;
  onOpenSettings: () => void;
  onImport: () => void;
  importing: boolean;
}

interface NavItemProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function NavItem({ active, icon, label, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({
  view,
  playlists,
  onNavigate,
  onCreatePlaylist,
  onOpenSettings,
  onImport,
  importing,
}: SidebarProps) {
  const isPlaylistView = view.kind === "playlist";

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <AudioLines size={17} strokeWidth={2} />
        </span>
        <span className="brand-text">
          <strong>Cloud Music</strong>
          <small>本地音乐</small>
        </span>
      </div>

      <nav className="nav-group" aria-label="主导航">
        <NavItem
          active={view.kind === "library"}
          icon={<Music2 size={18} />}
          label="全部歌曲"
          onClick={() => onNavigate({ kind: "library" })}
        />
        <NavItem
          active={view.kind === "artists"}
          icon={<UsersRound size={18} />}
          label="歌手"
          onClick={() => onNavigate({ kind: "artists" })}
        />
        <NavItem
          active={view.kind === "playlists" || isPlaylistView}
          icon={<ListMusic size={18} />}
          label="歌单"
          onClick={() => onNavigate({ kind: "playlists" })}
        />
        <NavItem
          active={view.kind === "liked"}
          icon={<Heart size={18} />}
          label="我喜欢的"
          onClick={() => onNavigate({ kind: "liked" })}
        />
      </nav>

      <div className="sidebar-section-head">
        <span>我的歌单</span>
        <button
          type="button"
          className="icon-button is-quiet"
          onClick={onCreatePlaylist}
          title="新建歌单"
          aria-label="新建歌单"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="sidebar-playlists">
        {playlists.length === 0 ? (
          <p className="sidebar-hint">还没有歌单</p>
        ) : (
          playlists.map((playlist) => (
            <button
              type="button"
              key={playlist.id}
              className={`playlist-link ${
                isPlaylistView && view.id === playlist.id ? "is-active" : ""
              }`}
              onClick={() => onNavigate({ kind: "playlist", id: playlist.id })}
              title={playlist.name}
            >
              <span>{playlist.name}</span>
              <small>{formatCount(playlist.trackIds.length)}</small>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-action"
          onClick={onImport}
          disabled={importing}
        >
          {importing ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <FolderPlus size={16} />
          )}
          <span>导入音乐</span>
        </button>
        <button type="button" className="sidebar-action" onClick={onOpenSettings}>
          <Settings2 size={16} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}

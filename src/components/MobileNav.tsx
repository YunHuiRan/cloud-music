import type { ReactNode } from "react";
import {
  Heart,
  ListMusic,
  Music2,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { View } from "../types";

interface MobileNavProps {
  view: View;
  onNavigate: (view: View) => void;
  onOpenSettings: () => void;
}

const items: Array<{ kind: View["kind"]; label: string; icon: ReactNode }> = [
  { kind: "library", label: "歌曲", icon: <Music2 size={20} /> },
  { kind: "artists", label: "歌手", icon: <UsersRound size={20} /> },
  { kind: "playlists", label: "歌单", icon: <ListMusic size={20} /> },
  { kind: "liked", label: "喜欢", icon: <Heart size={20} /> },
];

export function MobileNav({ view, onNavigate, onOpenSettings }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {items.map((item) => {
        const active =
          view.kind === item.kind ||
          (item.kind === "playlists" && view.kind === "playlist");
        return (
          <button
            type="button"
            key={item.kind}
            className={active ? "is-active" : ""}
            onClick={() => onNavigate({ kind: item.kind } as View)}
            aria-current={active ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
      <button type="button" onClick={onOpenSettings}>
        <Settings2 size={20} />
        <span>设置</span>
      </button>
    </nav>
  );
}

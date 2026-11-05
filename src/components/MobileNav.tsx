import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ListMusic,
  Music2,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { View } from "../types";
import { useLiquidSurface } from "./useLiquidSurface";

interface MobileNavProps {
  view: View;
  settingsOpen?: boolean;
  onNavigate: (view: View) => void;
  onOpenSettings: () => void;
}

const items: Array<{ kind: View["kind"]; label: string; icon: ReactNode }> = [
  { kind: "library", label: "歌曲", icon: <Music2 size={20} /> },
  { kind: "artists", label: "歌手", icon: <UsersRound size={20} /> },
  { kind: "playlists", label: "歌单", icon: <ListMusic size={20} /> },
];

export function MobileNav({
  view,
  settingsOpen = false,
  onNavigate,
  onOpenSettings,
}: MobileNavProps) {
  const navigateToIndex = useCallback(
    (index: number) => {
      if (index === items.length) {
        onOpenSettings();
        return;
      }
      const item = items[index];
      if (item) onNavigate({ kind: item.kind } as View);
    },
    [onNavigate, onOpenSettings],
  );
  const liquid = useLiquidSurface<HTMLElement>({
    draggable: true,
    onDragSelect: navigateToIndex,
  });
  const navRef = liquid.ref;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  const activeIndex = settingsOpen
    ? items.length
    : Math.max(
        0,
        items.findIndex(
          (item) =>
            view.kind === item.kind ||
            (item.kind === "playlists" && view.kind === "playlist"),
        ),
      );

  const measure = useCallback(() => {
    const button = buttonRefs.current[activeIndex];
    if (!button) return;
    setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const nav = navRef.current;
    const observer = nav ? new ResizeObserver(measure) : null;
    if (nav) observer?.observe(nav);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  const renderButton = (
    index: number,
    label: string,
    icon: ReactNode,
    active: boolean,
    action: () => void,
  ) => (
    <button
      type="button"
      key={label}
      ref={(node) => {
        buttonRefs.current[index] = node;
      }}
      className={active ? "is-active" : ""}
      data-liquid-index={index}
      onClick={action}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <nav
      className={`mobile-nav liquid-surface ${liquid.dragging ? "is-dragging" : ""}`}
      aria-label="移动端导航"
      ref={navRef}
      style={liquid.style}
      {...liquid.handlers}
    >
      {liquid.decor}
      <span
        className={`mobile-nav-indicator${ready ? " is-ready" : ""}`}
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
        }}
        aria-hidden="true"
      />
      {items.map((item, index) =>
        renderButton(
          index,
          item.label,
          item.icon,
          activeIndex === index,
          () => onNavigate({ kind: item.kind } as View),
        ),
      )}
      {renderButton(
        items.length,
        "设置",
        <Settings2 size={20} />,
        settingsOpen,
        onOpenSettings,
      )}
    </nav>
  );
}

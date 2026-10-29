import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SHORTCUT_DEFS = [
  {
    action: "togglePlayback",
    label: "播放 / 暂停",
    description: "控制当前正在播放的歌曲",
    default: "Space",
  },
  {
    action: "previous",
    label: "上一首",
    description: "回到播放队列中的上一首",
    default: "Ctrl+ArrowLeft",
  },
  {
    action: "next",
    label: "下一首",
    description: "播放播放队列中的下一首",
    default: "Ctrl+ArrowRight",
  },
  {
    action: "volumeUp",
    label: "音量增加",
    description: "每次提高 5% 音量",
    default: "ArrowUp",
  },
  {
    action: "volumeDown",
    label: "音量降低",
    description: "每次降低 5% 音量",
    default: "ArrowDown",
  },
  {
    action: "mute",
    label: "静音",
    description: "打开或关闭静音",
    default: "M",
  },
  {
    action: "search",
    label: "搜索",
    description: "聚焦顶部搜索框",
    default: "/",
  },
  {
    action: "openSettings",
    label: "打开设置",
    description: "打开设置窗口",
    default: "Ctrl+,",
  },
] as const;

export type ShortcutAction = (typeof SHORTCUT_DEFS)[number]["action"];
export type ShortcutMap = Record<ShortcutAction, string>;

const DEFAULT_SHORTCUTS = Object.fromEntries(
  SHORTCUT_DEFS.map((item) => [item.action, item.default]),
) as ShortcutMap;

interface SettingsState {
  shortcuts: ShortcutMap;
  setShortcut: (action: ShortcutAction, binding: string) => void;
  resetShortcuts: () => void;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph"]);

function normalizeKey(key: string): string {
  if (key === " " || key === "Spacebar") return "Space";
  if (key === "Esc") return "Escape";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function bindingFromEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key) || event.key === "Unidentified") return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(normalizeKey(event.key));
  return parts.join("+");
}

export function matchesShortcut(
  event: KeyboardEvent,
  binding: string | undefined,
): boolean {
  if (!binding) return false;
  const parts = binding.split("+");
  const key = parts.pop();
  const modifiers = new Set(parts);
  return (
    normalizeKey(event.key) === key &&
    event.ctrlKey === modifiers.has("Ctrl") &&
    event.altKey === modifiers.has("Alt") &&
    event.shiftKey === modifiers.has("Shift") &&
    event.metaKey === modifiers.has("Meta")
  );
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "空格",
  Escape: "Esc",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Meta: "Win",
};

export function formatBinding(binding: string): string {
  return binding
    .split("+")
    .map((part) => KEY_LABELS[part] ?? part)
    .join("+");
}

export function shortcutLabel(action: ShortcutAction): string {
  const definition = SHORTCUT_DEFS.find((item) => item.action === action);
  return definition?.label ?? action;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setShortcut: (action, binding) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: binding },
        })),
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: "cloudmusic.settings.v1",
      version: 1,
      merge: (persisted, current) => {
        const saved = persisted as { shortcuts?: Partial<ShortcutMap> } | undefined;
        return {
          ...current,
          shortcuts: { ...DEFAULT_SHORTCUTS, ...saved?.shortcuts },
        };
      },
    },
  ),
);

export { DEFAULT_SHORTCUTS };

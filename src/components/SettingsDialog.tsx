import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileAudio,
  FolderPlus,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { toast } from "../lib/toast";
import { nativeBridge } from "../lib/platform";
import { isAndroidApp } from "../lib/android-shell";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { artistLine } from "../lib/format";
import type { CloseBehavior } from "../types";
import {
  SHORTCUT_DEFS,
  bindingFromEvent,
  formatBinding,
  useSettings,
  type ShortcutAction,
} from "../lib/settings";

interface SettingsDialogProps {
  trackCount: number;
  isNative: boolean;
  importing: boolean;
  onImportFolder: () => void;
  onImportFiles: () => void;
  onClose: () => void;
}

const CLOSE_OPTIONS: Array<{
  value: CloseBehavior;
  title: string;
  description: string;
}> = [
  {
    value: "ask",
    title: "每次询问",
    description: "点击关闭时弹出选择，也可以记住那次选择",
  },
  {
    value: "minimize",
    title: "最小化到托盘",
    description: "保留播放状态，收起到系统托盘",
  },
  {
    value: "quit",
    title: "直接关闭",
    description: "立即退出 Cloud Music",
  },
];

export function SettingsDialog({
  trackCount,
  isNative,
  importing,
  onImportFolder,
  onImportFiles,
  onClose,
}: SettingsDialogProps) {
  const shortcuts = useSettings((state) => state.shortcuts);
  const setShortcut = useSettings((state) => state.setShortcut);
  const resetShortcuts = useSettings((state) => state.resetShortcuts);
  const tracks = useLibrary((state) => state.tracks);
  const invalidTracks = useLibrary((state) => state.invalidTracks);
  const refreshLibrary = useLibrary((state) => state.refreshLibrary);
  const clearInvalid = useLibrary((state) => state.clearInvalid);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>("ask");
  const [closeBusy, setCloseBusy] = useState(false);
  const android = isAndroidApp();
  const canConfigureClose = isNative && Boolean(nativeBridge?.getCloseBehavior);

  useEffect(() => {
    if (!isNative || !nativeBridge?.getCloseBehavior) return;
    let active = true;
    void nativeBridge
      .getCloseBehavior()
      .then((value) => {
        if (active) setCloseBehavior(value);
      })
      .catch(() => {
        // Keep the default; the setting is optional.
      });
    return () => {
      active = false;
    };
  }, [isNative]);

  const chooseCloseBehavior = async (value: CloseBehavior) => {
    if (!nativeBridge?.setCloseBehavior || closeBusy) return;
    setCloseBusy(true);
    try {
      const saved = await nativeBridge.setCloseBehavior(value);
      setCloseBehavior(saved);
      toast(
        saved === "ask"
          ? "关闭窗口时会先询问"
          : saved === "minimize"
            ? "关闭窗口时将最小化到系统托盘"
            : "关闭窗口时将直接退出",
      );
    } catch {
      toast("关闭行为保存失败");
    } finally {
      setCloseBusy(false);
    }
  };

  const quitApp = async () => {
    try {
      await nativeBridge?.quit?.();
    } catch {
      toast("退出失败，请再试一次");
    }
  };

  const refreshSongs = async () => {
    if (!nativeBridge?.refreshLibrary || refreshing) return;
    setRefreshing(true);
    try {
      const entries = tracks.map((track) => ({ id: track.id, path: track.path }));
      const result = await nativeBridge.refreshLibrary(entries);
      refreshLibrary(result.valid, result.missing);
      usePlayer.getState().pruneQueue(result.missing);
      toast(
        result.missing.length > 0
          ? `已刷新：${result.missing.length} 首歌已失效`
          : "已刷新：歌曲文件都还在",
      );
    } catch {
      toast("刷新失败，请稍后再试");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!recording) return;

    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        setRecording(null);
        return;
      }

      const binding = bindingFromEvent(event);
      if (!binding) return;

      const owner = SHORTCUT_DEFS.find(
        (item) => item.action !== recording && shortcuts[item.action] === binding,
      );
      if (owner) {
        toast(`「${owner.label}」已经使用了 ${formatBinding(binding)}`);
        return;
      }

      setShortcut(recording, binding);
      setRecording(null);
      toast(`快捷键已更新为 ${formatBinding(binding)}`);
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, setShortcut, shortcuts]);

  return (
    <Dialog
      title="设置"
      description={android ? "导入音乐、整理曲库。所有设置只保存在本机。" : "导入音乐、调整窗口行为和快捷键。所有设置只保存在本机。"}
      width={560}
      onClose={onClose}
      footer={
        <button type="button" className="button" onClick={onClose}>
          完成
        </button>
      }
    >
      <section className="settings-section">
        <div className="settings-heading">
          <h3>音乐库</h3>
          <span>{trackCount} 首歌</span>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onImportFolder}
            disabled={importing}
          >
            {importing ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <FolderPlus size={15} />
            )}
            导入文件夹
          </button>
          {!isNative && (
            <button type="button" className="button" onClick={onImportFiles}>
              <FileAudio size={15} />
              选择文件
            </button>
          )}
        </div>
        <p className="settings-hint">
          {android
            ? "也可以从系统文件管理器选择音频文件。"
            : isNative
              ? "也可以直接把音频文件或文件夹拖进主窗口。"
              : "浏览器预览不会保存导入的文件，刷新后需要重新选择。"}
        </p>
        {isNative && nativeBridge?.refreshLibrary && (
          <div className="settings-actions settings-refresh">
            <button
              type="button"
              className="button"
              onClick={() => void refreshSongs()}
              disabled={refreshing || tracks.length === 0}
            >
              {refreshing ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              刷新歌曲
            </button>
            <span className="settings-hint inline">
              文件不在了会移到下方「已失效」。
            </span>
          </div>
        )}
        {invalidTracks.length > 0 && (
          <div className="invalid-block">
            <div className="invalid-head">
              <strong>
                <AlertTriangle size={14} />
                已失效 {invalidTracks.length} 首
              </strong>
              <button
                type="button"
                className="text-button is-danger"
                onClick={() => {
                  clearInvalid();
                  toast("已清空失效歌曲，本地文件未受影响");
                }}
              >
                <Trash2 size={14} />
                清空
              </button>
            </div>
            <div className="invalid-list">
              {invalidTracks.map((track) => (
                <div className="invalid-row" key={track.id}>
                  <span>
                    <strong>{track.title}</strong>
                    <small>{artistLine(track.artists)}</small>
                  </span>
                  <small className="invalid-path" title={track.path}>
                    {track.fileName}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {canConfigureClose && (
        <section className="settings-section">
          <div className="settings-heading">
            <h3>关闭窗口时</h3>
            <span>随时可改</span>
          </div>
          <p className="settings-hint">
            点击窗口右上角的关闭按钮时，按这里的选择执行。
          </p>
          <div
            className="close-behavior-list"
            role="radiogroup"
            aria-label="关闭窗口时"
          >
            {CLOSE_OPTIONS.map((option) => {
              const selected = closeBehavior === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`close-behavior ${selected ? "is-selected" : ""}`}
                  onClick={() => void chooseCloseBehavior(option.value)}
                  disabled={closeBusy}
                >
                  <span className="close-behavior-dot" aria-hidden="true" />
                  <span className="close-behavior-copy">
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                  {selected && <Check size={15} className="close-behavior-check" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="button button-quiet close-quit"
            onClick={() => void quitApp()}
          >
            <LogOut size={14} />
            退出 Cloud Music
          </button>
        </section>
      )}

      {!android && (
        <section className="settings-section">
          <div className="settings-heading">
            <h3>快捷键</h3>
            <button
              type="button"
              className="button button-quiet settings-reset"
              onClick={() => {
                resetShortcuts();
                setRecording(null);
                toast("快捷键已恢复默认");
              }}
            >
              <RotateCcw size={13} />
              恢复默认
            </button>
          </div>
          <p className="settings-hint">
            点击右侧按键，然后按下新的组合键；按 Esc 取消。
          </p>
          <div className="shortcut-list">
            {SHORTCUT_DEFS.map((item) => (
              <div className="shortcut-row" key={item.action}>
                <div className="shortcut-copy">
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </div>
                <button
                  type="button"
                  className={`shortcut-key ${
                    recording === item.action ? "is-recording" : ""
                  }`}
                  onClick={() =>
                    setRecording((current) =>
                      current === item.action ? null : item.action,
                    )
                  }
                  aria-label={`修改「${item.label}」快捷键`}
                >
                  {recording === item.action
                    ? "请按键…"
                    : formatBinding(shortcuts[item.action])}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="settings-section">
        <div className="settings-heading">
          <h3>关于</h3>
          <span>1.0.0</span>
        </div>
        <p className="settings-about">
          Cloud Music · 本地音乐播放器
          <br />
          不联网，不上传，所有音乐都留在这台设备上。
        </p>
      </section>
    </Dialog>
  );
}

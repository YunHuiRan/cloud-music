import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Theme } from "../types";

interface ShiyinThemePlugin {
  setSystemBarsColor(options: { color: string }): Promise<void>;
}

const ShiyinTheme = registerPlugin<ShiyinThemePlugin>("ShiyinTheme");

export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === "android";
}

export function initAndroidShell(): void {
  if (!isAndroidApp()) return;
  document.documentElement.classList.add("android");

  void CapacitorApp.addListener("backButton", () => {
    const event = new CustomEvent("shiyin:android-back", { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) {
      void CapacitorApp.exitApp();
    }
  });
}

export function applyAndroidTheme(theme: Theme): void {
  if (!isAndroidApp()) return;
  const dark = theme === "dark";
  const color = dark ? "#171C26" : "#F5F7FC";
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  void StatusBar.setBackgroundColor({ color });
  void ShiyinTheme.setSystemBarsColor({ color });
}

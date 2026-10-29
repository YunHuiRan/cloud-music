import { Capacitor, registerPlugin } from "@capacitor/core";
import type { MediaSessionState, NativeBridge } from "./platform";
import type { ScannedTrack } from "../types";

interface ShiyinLibraryPlugin {
  pickFolder(): Promise<{ folder?: string } | null>;
  scanFolder(options: { folder: string }): Promise<{ tracks: ScannedTrack[] }>;
  refreshLibrary(options: {
    entries: Array<{ id: string; path: string }>;
  }): Promise<{ valid: string[]; missing: string[] }>;
}

interface ShiyinPlaybackPlugin {
  update(options: MediaSessionState): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "mediaAction",
    listener: (event: { action: string; position?: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const libraryPlugin = registerPlugin<ShiyinLibraryPlugin>("ShiyinLibrary");
const playbackPlugin = registerPlugin<ShiyinPlaybackPlugin>("ShiyinPlayback");

export const capacitorBridge: NativeBridge | undefined = Capacitor.isNativePlatform()
  ? {
      platform: "capacitor",
      version: Capacitor.getPlatform(),
      async pickFolder() {
        const result = await libraryPlugin.pickFolder();
        return typeof result?.folder === "string" && result.folder.length > 0 ? result.folder : null;
      },
      async scanFolder(folder) {
        const result = await libraryPlugin.scanFolder({ folder });
        return result?.tracks ?? [];
      },
      async refreshLibrary(entries) {
        return libraryPlugin.refreshLibrary({ entries });
      },
      updateMediaSession(state) {
        void playbackPlugin.update(state).catch(() => {
          // The media session is best-effort; playback must keep working.
        });
      },
      clearMediaSession() {
        void playbackPlugin.stop().catch(() => {
          // Nothing to clear.
        });
      },
      onMediaAction(callback) {
        void playbackPlugin
          .addListener("mediaAction", (event) => callback(event.action, event.position))
          .catch(() => {
            // Older Android builds may not expose the plugin.
          });
      },
      mediaSrc(path) {
        return Capacitor.convertFileSrc(path);
      },
    }
  : undefined;

import type { CapacitorConfig } from "@capacitor/cli";

// Install the Capacitor packages from docs/ANDROID.md before running the CLI.
const config: CapacitorConfig = {
  appId: "com.shiyin.player",
  appName: "Cloud Music",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;

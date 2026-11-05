import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shiyin.player",
  appName: "Cloud Music",
  webDir: "dist",
  server: { androidScheme: "https" },
};

export default config;

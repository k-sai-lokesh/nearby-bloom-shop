import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.hyperlocalconnect",
  appName: "HyperLocal Connect",
  webDir: "dist/client",
  server: {
    // The app is server-rendered, so the native shell loads the hosted site.
    // Swap this to your LAN dev URL (http://192.168.x.x:8080) for live reload.
    url: "https://nearby-bloom-shop.lovable.app",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0F172A",
      showSpinner: false,
    },
  },
};

export default config;

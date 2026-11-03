import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the built web app (dist/) as an iOS app. After changing web code: npm run build && npx cap sync ios.
const config: CapacitorConfig = {
  appId: "com.gabycruz.xochiwell",
  appName: "Xochiwell",
  webDir: "dist",
  backgroundColor: "#f3efe9",
  ios: { contentInset: "never" },
  plugins: {
    // Sends fetch() through native networking, so the app can call Open Food Facts directly
    // (a browser would block those requests without the dev server's proxy).
    CapacitorHttp: { enabled: true },
  },
};

export default config;

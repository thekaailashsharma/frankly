import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // The recognition model is fetched from Hugging Face at runtime and
      // cached by the browser — not bundled — so the app shell installs
      // instantly and the model downloads once, in the background, at
      // host setup rather than blocking first load.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "frankly-models",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Frankly",
        short_name: "Frankly",
        description: "Write feedback by hand.",
        start_url: "/",
        display: "standalone",
        background_color: "#FAF8F3",
        theme_color: "#C4622D",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});

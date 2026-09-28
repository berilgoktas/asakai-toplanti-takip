import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  envDir: "..",
  server: {
    port: 3005,
    strictPort: true
  },
  preview: {
    port: 3005,
    strictPort: true
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "Toplanti Takip",
        short_name: "Toplanti",
        description: "Toplanti katilimcilarini ve surelerini takip etmek icin uygulama",
        theme_color: "#1976d2",
        background_color: "#f1f5f9",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
});

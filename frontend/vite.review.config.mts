import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true } },
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ["import", "global-builtin", "color-functions"],
      },
    },
  },
});

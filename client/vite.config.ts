import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:single` produces one self-contained index.html (used for the hosted preview).
// base "./" makes every asset path relative, so the same build works at a domain root
// and in a sub-folder such as https://<user>.github.io/ai-wardrobe/.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: mode === "single" ? "dist-single" : "dist" },
}));

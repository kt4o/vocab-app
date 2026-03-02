import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,  // Detects all file changes reliably
    },
    hmr: {
      overlay: true,     // Shows compile errors in browser
    },
  },
});

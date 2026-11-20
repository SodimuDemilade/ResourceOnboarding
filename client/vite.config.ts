import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Requests to /api/... are forwarded to the Express server, so the browser
    // only ever talks to one origin (no CORS setup needed in development).
    // The browser only ever talks to localhost:5173, and Vite quietly forwards /api/cases to localhost:3001/cases.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});

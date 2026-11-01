import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    // Open Food Facts' APIs don't reliably allow browser calls from other sites, so proxy them.
    proxy: {
      "/api/off": {
        target: "https://search.openfoodfacts.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/off/, ""),
        headers: { "User-Agent": "not-myfitnesspal/0.1 (calorie tracker)" },
      },
      // Product details (serving sizes) only live in the main Open Food Facts API.
      "/api/products": {
        target: "https://world.openfoodfacts.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/products/, "/api/v2/search"),
        headers: { "User-Agent": "not-myfitnesspal/0.1 (calorie tracker)" },
      },
    },
  },
});

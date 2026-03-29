import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import path from "node:path"

export default defineConfig({
  integrations: [react()],
  output: "static",
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve("./src"),
        "@shared": path.resolve("../shared/src"),
      },
    },
  },
})

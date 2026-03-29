import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const frontendRoot = path.resolve(__dirname)
const workspaceRoot = path.resolve(__dirname, "..")

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return
          }

          if (
            id.includes("@tiptap") ||
            id.includes("prosemirror") ||
            id.includes("lowlight") ||
            id.includes("markdown-it") ||
            id.includes("linkify-it") ||
            id.includes("mdurl") ||
            id.includes("uc.micro") ||
            id.includes("orderedmap") ||
            id.includes("rope-sequence")
          ) {
            return "editor-vendor"
          }

          if (
            id.includes("@blocknote") ||
            id.includes("@mantine") ||
            id.includes("prismjs") ||
            id.includes("react-notion-x") ||
            id.includes("notion-client")
          ) {
            return "rich-content-vendor"
          }

          if (id.includes("date-fns") || id.includes("react-day-picker")) {
            return "date-vendor"
          }
        },
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 3001,
    fs: {
      allow: [frontendRoot, workspaceRoot],
    },
  },
  define: {
    "process.env": {
      NODE_ENV: process.env.NODE_ENV || "development",
    },
  },
})

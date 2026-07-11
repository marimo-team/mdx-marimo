import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const basePath = process.env.BASE_PATH?.replace(/\/$/, "") ?? "/mdx-marimo";
const siteBase = basePath ? `${basePath}/` : "/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? siteBase : "/",
  server: {
    host: "127.0.0.1",
    port: 4100,
  },
  plugins: [
    mdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          enabled: true,
          crawlLinks: true,
        },
      },
      pages: [
        {
          path: "/",
        },
        {
          path: "/docs",
        },
        {
          path: "/api/search",
        },
      ],
    }),
    react(),
    nitro({ baseURL: command === "build" ? siteBase : "/" }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));

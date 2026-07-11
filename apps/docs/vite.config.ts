import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/mdx-marimo/" : "/",
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
    nitro({ baseURL: command === "build" ? "/mdx-marimo/" : "/" }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));

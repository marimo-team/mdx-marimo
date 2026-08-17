import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

const basePath = process.env.BASE_PATH?.replace(/\/$/, "") ?? "/mdx-marimo";
const siteBase = basePath ? `${basePath}/` : "/";
const staticCachePath = `${basePath}/__tsr/`;

const previewStaticCachePlugin: Plugin = {
  name: "preview-static-cache-path",
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url?.startsWith(staticCachePath)) {
        request.url = request.url.slice(basePath.length);
      }
      next();
    });
  },
};

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? siteBase : "/",
  server: {
    host: "127.0.0.1",
    port: 4100,
  },
  plugins: [
    previewStaticCachePlugin,
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
    nitro({ baseURL: command === "build" || isPreview ? siteBase : "/" }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
}));

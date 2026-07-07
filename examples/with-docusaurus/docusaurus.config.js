// @ts-check

import { marimoReactMdx } from "@marimo-team/mdx-marimo/react";

/** @type {import("@docusaurus/types").Config} */
const config = {
  title: "Docusaurus MDX marimo",
  tagline: "Interactive marimo islands in Docusaurus MDX",
  url: "https://example.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      /** @type {import("@docusaurus/preset-classic").Options} */
      ({
        docs: {
          path: "docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.js",
          remarkPlugins: [marimoReactMdx()],
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import("@docusaurus/preset-classic").ThemeConfig} */
    ({
      navbar: {
        title: "marimo MDX",
        items: [
          {
            type: "docSidebar",
            sidebarId: "guide",
            position: "left",
            label: "Pages",
          },
        ],
      },
    }),
};

export default config;

# Docusaurus MDX marimo

This example renders marimo fences across multiple Docusaurus docs pages.

```bash
pnpm --dir examples/with-docusaurus dev
```

`docusaurus.config.js` registers `marimoReactMdx()` in `docs.remarkPlugins`. Docusaurus compiles each MDX page, the marimo plugin extracts the fenced cells, and the generated docs import `MarimoIsland` from `@marimo-team/mdx-marimo/react`.

`src/css/custom.css` imports the marimo island styles once for the site. Each docs page under `docs/` owns its own marimo cells and keeps the browser runtime reactive after navigation.

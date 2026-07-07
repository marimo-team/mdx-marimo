# React Vite MDX marimo

This example renders marimo code fences from `src/content.mdx` in a Vite React app.

```bash
pnpm --dir examples/with-react dev
```

`vite.config.ts` runs `@mdx-js/rollup` with `providerImportSource: "@mdx-js/react"` and `marimoReactMdx()`. The MDX compile step extracts each `python marimo` fence into a marimo output payload and replaces the fence with `MarimoIsland` from `@marimo-team/mdx-marimo/react`.

`src/main.tsx` mounts the MDX page through `MDXProvider` and imports `@marimo-team/mdx-marimo/styles.css`. In the browser, each island mounts the marimo runtime so the slider and dependent markdown cell stay reactive.

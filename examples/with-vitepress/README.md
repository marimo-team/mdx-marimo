# VitePress example

This example compiles marimo fences in VitePress Markdown, registers the
custom element from the theme entry, and maps VitePress theme tokens into the
islands.

Run the development server from the workspace root:

```bash
pnpm --filter @marimo-team/mdx-marimo-example-vitepress dev
```

Build and preview the static site:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-vitepress#build
pnpm --filter @marimo-team/mdx-marimo-example-vitepress preview
```

The two pages cover shared page state, dependent outputs, a configured
`wigglystuff` dependency, nested Markdown, client navigation, and separate page
identities.

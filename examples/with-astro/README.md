# Astro

This example renders reactive marimo cells in an Astro MDX page.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-astro dev
```

Open <http://127.0.0.1:4103>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Astro starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-astro#build
```

## Integration

- [`astro.config.mjs`](./astro.config.mjs) adds `remarkMarimo` to Astro's MDX
  processor.
- [`src/pages/index.mdx`](./src/pages/index.mdx) imports the island styles and
  custom-element runtime, then authors the marimo cells.

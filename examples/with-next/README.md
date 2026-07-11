# Next.js

This example renders reactive marimo cells in a Next.js Pages Router MDX page.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-next dev
```

Open <http://127.0.0.1:4104>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Next.js starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-next#build
```

## Integration

- [`next.config.mjs`](./next.config.mjs) adds `remarkMarimo` to `@next/mdx`.
- [`pages/_app.js`](./pages/_app.js) imports the island stylesheet and renders
  `MarimoIslandRuntime` once for the application.
- [`pages/index.mdx`](./pages/index.mdx) contains the dependent marimo cells.

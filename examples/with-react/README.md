# React and Vite

This example renders reactive marimo cells from MDX in a React application.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-react dev
```

Open <http://127.0.0.1:4101>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Vite starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-react#build
```

## Integration

- [`vite.config.ts`](./vite.config.ts) configures `@mdx-js/rollup` with
  `remarkMarimo` and the React MDX provider.
- [`src/main.tsx`](./src/main.tsx) imports the island stylesheet and renders
  `MarimoIslandRuntime` once for the application.
- [`src/content.mdx`](./src/content.mdx) contains the dependent marimo cells.

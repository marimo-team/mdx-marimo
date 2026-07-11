# Vue and Vite

This example renders reactive marimo cells from MDX in a Vue application.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-vue dev
```

Open <http://127.0.0.1:4102>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Vite starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-vue#build
```

## Integration

- [`vite.config.ts`](./vite.config.ts) configures `@mdx-js/rollup` with
  `remarkMarimo` and the Vue JSX runtime.
- [`src/main.ts`](./src/main.ts) imports the island stylesheet and registers
  the custom element.
- [`src/App.vue`](./src/App.vue) provides the Vue MDX context for
  [`src/content.mdx`](./src/content.mdx).

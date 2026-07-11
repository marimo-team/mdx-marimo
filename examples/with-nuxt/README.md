# Nuxt

This example renders reactive marimo cells from MDX in a Nuxt application.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-nuxt dev
```

Open <http://127.0.0.1:4106>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Nuxt starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-nuxt#build
```

Generate a static site with:

```bash
pnpm --filter @marimo-team/mdx-marimo-example-nuxt generate
```

## Integration

- [`nuxt.config.ts`](./nuxt.config.ts) configures Nuxt's Vite pipeline with
  `@mdx-js/rollup`, `remarkMarimo`, and the island stylesheet.
- [`app/plugins/marimo.client.ts`](./app/plugins/marimo.client.ts) registers
  the custom element after Nuxt mounts.
- [`content/index.mdx`](./content/index.mdx) contains the dependent marimo
  cells rendered by [`app/app.vue`](./app/app.vue).

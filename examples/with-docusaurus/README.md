# Docusaurus

This example renders dependent marimo cells across several Docusaurus MDX
pages.

## Run

Run the commands from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @marimo-team/mdx-marimo-example-docusaurus dev
```

Open <http://127.0.0.1:4105>. The `predev` script builds the local
`@marimo-team/mdx-marimo` package through Vite+ before Docusaurus starts.

Build the example and its workspace dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo-example-docusaurus#build
```

## Integration

- [`docusaurus.config.js`](./docusaurus.config.js) adds `remarkMarimo` to the
  docs remark plugins.
- [`src/theme/Root.js`](./src/theme/Root.js) registers the React island runtime
  after Docusaurus hydrates.
- [`src/css/custom.css`](./src/css/custom.css) imports the island stylesheet
  and maps the Docusaurus light and dark themes.
- [`docs/`](./docs) contains the MDX pages and their page-local marimo cells.

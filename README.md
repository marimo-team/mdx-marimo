<p align="center">
  <a href="https://marimo-team.github.io/mdx-marimo/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://marimo-team.github.io/mdx-marimo/brand/mdx-marimo-lockup-stacked-dark.svg">
      <img alt="mdx-marimo" src="https://marimo-team.github.io/mdx-marimo/brand/mdx-marimo-lockup-stacked-light.svg" width="320">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/marimo-team/mdx-marimo/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/marimo-team/mdx-marimo/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/@marimo-team/mdx-marimo"><img alt="npm" src="https://img.shields.io/npm/v/@marimo-team/mdx-marimo.svg"></a>
  <a href="https://spdx.org/licenses/MIT.html"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center"><strong>Run marimo wherever MDX runs.</strong></p>

Compose reactive Python, SQL, and Markdown cells inside documentation,
tutorials, and articles. Write marimo cells alongside ordinary content while
the host keeps control of the surrounding layout, components, navigation, and
theme.

mdx-marimo renders the initial output at build time, then hydrates the page with
Pyodide as one reactive notebook. Visitors can use controls, edit Python, and
rerun dependent cells in the browser.

## Get started

```bash
pnpm add @marimo-team/mdx-marimo
```

Add `remarkMarimo` to the host's MDX compiler. This Fumadocs configuration is
one example:

```ts
import { defineConfig } from "fumadocs-mdx/config";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMarimo],
  },
});
```

Import the stylesheet and mount the browser runtime once:

```tsx
import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";
import "@marimo-team/mdx-marimo/styles.css";

export function MdxRuntime() {
  return <MarimoIslandRuntime />;
}
```

Then write marimo cells between ordinary MDX:

````mdx
```python marimo editor=true
import marimo as mo

slider = mo.ui.slider(1, 10)
slider
```

This paragraph is ordinary MDX.

```python marimo
mo.md(f"The slider is set to **{slider.value}**.")
```
````

Every marimo fence on the page shares the same reactive notebook.
`editor=true` lets visitors edit and rerun the first cell, and the second cell
updates with it.

## Frameworks and examples

| Host           | Example                                                  |
| -------------- | -------------------------------------------------------- |
| Astro          | [`examples/with-astro`](./examples/with-astro)           |
| Docusaurus     | [`examples/with-docusaurus`](./examples/with-docusaurus) |
| Next.js        | [`examples/with-next`](./examples/with-next)             |
| Nuxt           | [`examples/with-nuxt`](./examples/with-nuxt)             |
| React and Vite | [`examples/with-react`](./examples/with-react)           |
| VitePress      | [`examples/with-vitepress`](./examples/with-vitepress)   |
| Vue and Vite   | [`examples/with-vue`](./examples/with-vue)               |

See the [documentation](./docs) for framework setup, authoring options, styling,
and public APIs. Browse the [examples](./examples) for complete integrations.

## Development

Use Node 24 from [`.node-version`](./.node-version) and the pnpm version pinned
in [`package.json`](./package.json).

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm ready
```

Repository architecture and validation are documented in
[`development_docs`](./development_docs/README.md).

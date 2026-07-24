# mdx-marimo

Add reactive Python, SQL, and Markdown cells to MDX pages.

All marimo cells on a page share one reactive namespace. Normal MDX can appear
between cells, and the host keeps control of the page layout and theme.

## Install

```bash
pnpm add @marimo-team/mdx-marimo
```

## Configure MDX

Add `remarkMarimo` to the host's remark plugins:

```ts
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

export default {
  remarkPlugins: [remarkMarimo],
};
```

Import the stylesheet once:

```ts
import "@marimo-team/mdx-marimo/styles.css";
```

React applications register the browser runtime from a client component:

```tsx
"use client";

import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";

export function MdxRuntime() {
  return <MarimoIslandRuntime />;
}
```

Astro, Vue, and other browser entries can register the custom element directly:

```ts
import "@marimo-team/mdx-marimo/element/auto";
```

## Write marimo cells

````mdx
```python marimo
import marimo as mo

slider = mo.ui.slider(1, 10, label="items")
slider
```

This paragraph is ordinary MDX.

```python marimo
mo.md(f"The slider is set to **{slider.value}**.")
```
````

Both cells belong to the same marimo notebook. The build includes their initial
output in the page, then Pyodide hydrates them in the browser.

Declare page dependencies in one `marimo-config` fence:

````mdx
```marimo-config
requires-python = ">=3.12"
dependencies = ["altair", "pandas"]
```
````

Cell options follow the `marimo` marker:

````mdx
```python marimo echo=true output=true
chart
```
````

See the
[documentation](https://github.com/marimo-team/mdx-marimo/tree/main/docs)
for framework setup, all cell options, styling properties, and public APIs.

Working integrations are available for
[Astro](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-astro),
[Docusaurus](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-docusaurus),
[Next.js](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-next),
[Nuxt](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-nuxt),
[React](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-react),
[VitePress](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-vitepress),
and [Vue](https://github.com/marimo-team/mdx-marimo/tree/main/examples/with-vue).

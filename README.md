# mdx-marimo

Add reactive Python examples, visualizations, and controls to an MDX site.
Visitors can use embedded controls or edit and rerun Python directly in the
page.

Marimo cells can appear anywhere in a page and share one reactive namespace.
The MDX host keeps control of the surrounding layout, components, navigation,
and theme.

## Quick start

```bash
pnpm add @marimo-team/mdx-marimo
```

Add `remarkMarimo` to the host's MDX compiler:

```ts
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

export default {
  remarkPlugins: [remarkMarimo],
};
```

Import the stylesheet and register the browser runtime once:

```tsx
import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";
import "@marimo-team/mdx-marimo/styles.css";

export function MdxRuntime() {
  return <MarimoIslandRuntime />;
}
```

Add marimo cells to an MDX page:

````mdx
```python marimo editor=true
import marimo as mo

slider = mo.ui.slider(1, 10, label="items")
slider
```

This paragraph is ordinary MDX.

```python marimo
mo.md(f"The slider is set to **{slider.value}**.")
```
````

`editor=true` shows marimo's Python editor for the first cell. Visitors can
change the source and click run. The site build includes the initial output,
then Pyodide executes edits in the browser, renders the new result, and reruns
dependent cells through the shared reactive notebook.

## Frameworks

| Host           | Example                                                  |
| -------------- | -------------------------------------------------------- |
| Astro          | [`examples/with-astro`](./examples/with-astro)           |
| Docusaurus     | [`examples/with-docusaurus`](./examples/with-docusaurus) |
| Next.js        | [`examples/with-next`](./examples/with-next)             |
| Nuxt           | [`examples/with-nuxt`](./examples/with-nuxt)             |
| React and Vite | [`examples/with-react`](./examples/with-react)           |
| Vue and Vite   | [`examples/with-vue`](./examples/with-vue)               |

The [documentation](./docs) covers framework setup, authoring
options, styling, public APIs, and the full marimo tutorial notebooks rendered
through MDX.

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

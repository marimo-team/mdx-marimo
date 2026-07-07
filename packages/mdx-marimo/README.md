# `@marimo-team/mdx-marimo`

`@marimo-team/mdx-marimo` turns marimo code fences into MDX custom elements. The plugin collects marimo cells, calls an extractor, and writes each `MarimoOutput` into a `<marimo-mdx-island>` element.

````mdx
```python marimo echo=true
import marimo as mo
slider = mo.ui.slider(1, 10, label="items")
slider
```
````

## Install

```bash
pnpm add @marimo-team/mdx-marimo
```

## Compile MDX

Use `marimoMdx` when the page should emit custom elements and use `extractMarimo`.

```ts
import { compile } from "@mdx-js/mdx";
import { marimoMdx } from "@marimo-team/mdx-marimo/preset";

const file = await compile(source, {
  jsx: true,
  remarkPlugins: [marimoMdx()],
});
```

The preset returns the `[remarkMarimo, options]` tuple expected by `remarkPlugins`. The compiled MDX emits `<marimo-mdx-island>` elements with one serialized `MarimoOutput` payload per cell.

Import the browser runtime and styles once from a client entry.

```ts
import "@marimo-team/mdx-marimo/element/auto";
import "@marimo-team/mdx-marimo/styles.css";
```

`@marimo-team/mdx-marimo/element/auto` registers `<marimo-mdx-island>` and installs document navigation handling. The package styles provide the `.marimo-island-host` layout and token contract.

Site CSS can map page theme tokens into marimo islands.

```css
.docs-page {
  --marimo-island-background: var(--page-bg);
  --marimo-island-foreground: var(--page-fg);
  --marimo-island-surface: var(--panel-bg);
  --marimo-island-muted-surface: var(--muted-bg);
  --marimo-island-muted-foreground: var(--muted-fg);
  --marimo-island-border: var(--border);
  --marimo-island-accent: var(--brand);
  --marimo-island-accent-foreground: var(--brand-fg);
  --marimo-island-focus-ring: var(--focus);
  --marimo-island-code-background: var(--code-bg);
  --marimo-island-code-foreground: var(--code-fg);
  --marimo-island-error-background: var(--error-bg);
  --marimo-island-error-border: var(--error-border);
  --marimo-island-error-foreground: var(--error-fg);
  --marimo-island-error-accent: var(--error);
  --marimo-island-radius: 0.5rem;
  --marimo-island-margin-block: 1rem;
}
```

Public styling tokens:

| Token                               | Purpose                                | Maps to                                       |
| ----------------------------------- | -------------------------------------- | --------------------------------------------- |
| `--marimo-island-background`        | Island and page background             | `--background`                                |
| `--marimo-island-foreground`        | Main text                              | `--foreground`                                |
| `--marimo-island-surface`           | Cards, inputs, panels                  | `--card`, `--popover`                         |
| `--marimo-island-muted-surface`     | Subtle panels, secondary controls      | `--muted`, `--secondary`                      |
| `--marimo-island-muted-foreground`  | Secondary text, comments, placeholders | `--muted-foreground`, `--cm-comment`          |
| `--marimo-island-border`            | Borders and input borders              | `--border`, `--input`                         |
| `--marimo-island-accent`            | Primary action and link color          | `--primary`, `--accent`                       |
| `--marimo-island-accent-foreground` | Text on accent backgrounds             | `--primary-foreground`, `--accent-foreground` |
| `--marimo-island-focus-ring`        | Focus outline and ring                 | `--ring`                                      |
| `--marimo-island-code-background`   | Code block and editor background       | `--cm-background`                             |
| `--marimo-island-code-foreground`   | Code block and editor text             | `--cm-foreground`                             |
| `--marimo-island-error-background`  | Error block background                 | Alert background                              |
| `--marimo-island-error-border`      | Error block border                     | Alert border                                  |
| `--marimo-island-error-foreground`  | Error body text                        | Alert text                                    |
| `--marimo-island-error-accent`      | Error title and destructive text       | Alert title                                   |
| `--marimo-island-radius`            | Island-owned rounded corners           | `--radius`, package error radius              |
| `--marimo-island-margin-block`      | Vertical spacing around islands        | Wrapper margin                                |

## Fence Contract

Use `python marimo`, `sql marimo`, or `markdown marimo` as the code fence info string. The dotted form also works.

````mdx
```python.marimo
1 + 1
```
````

Options follow the `marimo` marker.

````mdx
```python marimo echo=true output=true
1 + 1
```

```sql marimo query="result"
SELECT * FROM df
```
````

Supported cell options:

| Option          | Value   | Behavior                                            |
| --------------- | ------- | --------------------------------------------------- |
| `eval`          | boolean | Executes the cell during extraction.                |
| `echo`          | boolean | Shows source code in the rendered island.           |
| `output`        | boolean | Shows the rendered output.                          |
| `include`       | boolean | Includes the cell in the browser output.            |
| `editor`        | boolean | Shows code through the marimo editor view.          |
| `server-output` | boolean | Includes build-time output in the island HTML.      |
| `disabled`      | boolean | Marks the cell disabled for extraction.             |
| `unparsable`    | boolean | Passes source through as an unparsable cell.        |
| `hide-code`     | boolean | Hides visible source code.                          |
| `hide-output`   | boolean | Hides visible rendered output.                      |
| `query`         | string  | Names the output variable for SQL cells.            |
| `engine`        | string  | Passes the SQL engine name to the extraction layer. |
| `name`          | string  | Passes the cell name to the extraction layer.       |
| `column`        | number  | Passes the column position to the extraction layer. |

## Page Metadata

Add a `marimo-config` fence when a page needs extraction metadata.

````mdx
```marimo-config
requires-python = ">=3.12"
dependencies = ["numpy", "matplotlib"]
```
````

The plugin removes the config fence from the rendered page and passes its contents as `metadata.pyproject` to `extract`.

## API

### `marimoMdx`

```ts
const plugin = marimoMdx();
```

Returns the `[remarkMarimo, options]` tuple for `remarkPlugins`. The preset uses custom element output and the default extractor.

- `cwd`: Root used by the extractor and cache. Defaults to `process.cwd()`.
- `extract`: Custom extractor for this compile.
- `extractor`: Options for the default extractor.
- `output`: MDX output configuration. Defaults to `{ type: "element" }`.
- `identity`: Stable page identity string or a function that receives the public filename.

### `remarkMarimo`

```ts
const plugin = remarkMarimo(options);
```

Transforms marimo code fences into MDX JSX elements.

- `extract`: Receives a `MarimoPageRequest` and returns `MarimoPageResult`.
- `output`: MDX output configuration. Defaults to `{ type: "element" }`.
- `cwd`: Root used to make absolute file paths relative in extraction requests. Defaults to `process.cwd()`.
- `identity`: Stable page identity string or a function that receives the public filename.

Element output:

```ts
output: {
  type: "element",
  elementName: "marimo-mdx-island",
  theme: "auto",
  clientImportSource: "@marimo-team/mdx-marimo/element/auto",
}
```

Component output:

```ts
output: {
  type: "component",
  componentName: "MarimoIsland",
  importSource: "@marimo-team/mdx-marimo/react",
  importName: "MarimoIsland",
}
```

Use the explicit plugin form when the page supplies a custom extractor.

```ts
import { remarkMarimo } from "@marimo-team/mdx-marimo";
import { extractMarimo } from "@marimo-team/mdx-marimo/extractor";

const plugin = [
  remarkMarimo,
  {
    extract: (request) => extractMarimo(request),
    output: {
      type: "element",
      theme: "auto",
    },
  },
];
```

`extract` receives:

```ts
type MarimoPageRequest = {
  filename: string;
  identity: string;
  metadata: {
    pyproject?: string;
  };
  diagnostics: MarimoDiagnostic[];
  cells: MarimoCell[];
};
```

### `defineMarimoMdxIsland`

```ts
import { defineMarimoMdxIsland } from "@marimo-team/mdx-marimo/element";

defineMarimoMdxIsland();
```

Registers the custom element used by custom element output. Use `@marimo-team/mdx-marimo/element/auto` when the app should register the element and document navigation handling from one import.

### `mountMarimoIsland`

```ts
import { mountMarimoIsland } from "@marimo-team/mdx-marimo/browser";

const cleanup = mountMarimoIsland(host, output, { theme: "auto" });
cleanup();
```

Renders one `MarimoOutput` into an existing `HTMLElement`, loads runtime assets, applies the theme bridge, and returns a cleanup callback.

### React adapter

```ts
import { marimoReactMdx } from "@marimo-team/mdx-marimo/react";

const plugin = marimoReactMdx();
```

Returns the `[remarkMarimo, options]` tuple for React MDX compilers. The compiled MDX imports `MarimoIsland` from `@marimo-team/mdx-marimo/react`.

```tsx
import { MarimoIsland } from "@marimo-team/mdx-marimo/react";

<MarimoIsland output={output} className="altair-example" theme="auto" />;
```

`MarimoIsland` receives one `MarimoOutput` and standard React composition props.

```ts
type MarimoIslandProps = {
  output: MarimoOutput;
  className?: string;
  style?: MarimoIslandStyle;
  theme?: "auto" | "light" | "dark";
};
```

### `extractMarimo`

```ts
const result = await extractMarimo(request);
```

Runs the Python extractor through `uv`, caches the result under `.marimo-cache`, and returns `MarimoPageResult`.

- `cwd`: Working directory for `uv` and cache files.
- `timeoutMs`: Extraction timeout. Defaults to `300000`.
- `uvCommand`: Command path for this call.
- `MDX_MARIMO_UV`: Environment variable for the default `uv` command.

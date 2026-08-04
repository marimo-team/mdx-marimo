# Islands bridge

`packages/islands-bridge` is the framework-neutral workspace package behind
`@marimo-team/mdx-marimo`. It defines the page compilation protocol and
provides browser utilities for mounting compiled cells, loading shared assets,
following host themes, and managing page lifecycle.

Host adapters compile their source format into a `MarimoPageRequest`. The marimo compiler returns one `CompiledMarimoPage` with shared app assets and one result for every authored cell.

```ts
import type {
  CompiledMarimoPage,
  MarimoPageRequest,
} from "@marimo-team/mdx-marimo/bridge/protocol";
```

Browser adapters project one app carrier, references for its sibling cells,
and no payload for excluded cells.

```ts
import { projectPageCellPayloads } from "@marimo-team/mdx-marimo/bridge/protocol";

const payloads = projectPageCellPayloads(page);
```

Dynamic hosts can assign a validated carrier or reference payload directly to
the custom element.

```ts
import {
  defineMarimoIslandElement,
  type MarimoIslandElement,
} from "@marimo-team/mdx-marimo/bridge/element";

defineMarimoIslandElement({ name: "marimo-book-island", host: "book" });
const island = document.createElement("marimo-book-island") as MarimoIslandElement;
island.payload = payload;
```

Hosts whose render layer replaces wrapper elements can retain an equivalent
island across render cycles.

```ts
import { mountMarimoIslandElement } from "@marimo-team/mdx-marimo/bridge/element";

const mounted = mountMarimoIslandElement(host, payload, {
  name: "marimo-book-island",
  host: "book",
  releaseDelayFrames: 2,
});

return mounted.release;
```

The host selects `releaseDelayFrames` to cover its replacement cycle. A new
mount with the same app, cell, element name, and payload adopts the live
element. A changed payload creates a new element.

Before initialization, the asset lease publishes `app.notebookCode` through
`window.__MARIMO_EXPORT_CONTEXT__`. Replacing the page's island elements
re-runs the idempotent initializer while retaining the active worker on marimo
0.23.16 and newer.

Publishing hosts own source parsing, AST traversal, output placement, and framework lifecycle integration.

The bridge wraps the inner payload and reactive executor provided by
`@marimo-team/islands` with a page-level publishing contract. Every authored
cell keeps its own initial HTML while the page shares one runtime, asset set,
and notebook source.

## Styling

Import the shared stylesheet and map these tokens to the publishing host's theme.

```css
@import "@marimo-team/mdx-marimo/bridge/styles.css";

.article {
  --marimo-island-background: var(--page-background);
  --marimo-island-foreground: var(--page-foreground);
  --marimo-island-accent: var(--primary);
}
```

Hosts that receive a fingerprinted stylesheet URL at runtime can install it in
the owning document.

```ts
import { installMarimoIslandStyles } from "@marimo-team/mdx-marimo/bridge/browser";

installMarimoIslandStyles(stylesheetUrl);
```

Changing `data-marimo-theme-mode` updates the connected island theme. Hosts
with another theme signal can pass `themeResolver` when defining the custom
element.

| Token                               | Controls                        |
| ----------------------------------- | ------------------------------- |
| `--marimo-island-background`        | Island background               |
| `--marimo-island-foreground`        | Main text                       |
| `--marimo-island-surface`           | Cards, inputs, and popovers     |
| `--marimo-island-muted-surface`     | Secondary surfaces              |
| `--marimo-island-muted-foreground`  | Secondary text and placeholders |
| `--marimo-island-border`            | Borders and inputs              |
| `--marimo-island-accent`            | Primary controls and links      |
| `--marimo-island-accent-foreground` | Text on accent surfaces         |
| `--marimo-island-focus-ring`        | Keyboard focus ring             |
| `--marimo-island-code-background`   | Code blocks and editors         |
| `--marimo-island-code-foreground`   | Code text                       |
| `--marimo-island-error-background`  | Error surface                   |
| `--marimo-island-error-border`      | Error border                    |
| `--marimo-island-error-foreground`  | Error body text                 |
| `--marimo-island-error-accent`      | Error title                     |
| `--marimo-island-radius`            | Island-owned corner radius      |
| `--marimo-island-margin-block`      | Space around each island        |

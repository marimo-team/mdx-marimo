# Islands bridge

`packages/islands-bridge` is the framework-neutral workspace package behind
`@marimo-team/mdx-marimo`. It defines the page compilation protocol and
provides browser utilities for mounting compiled cells, loading shared assets,
following host themes, and managing page lifecycle.

Host adapters compile their source format into a `MarimoPageRequest`. The marimo compiler returns one `CompiledMarimoPage` with shared app assets and one result for every authored cell.

```ts
import type { CompiledMarimoPage, MarimoPageRequest } from "@marimo-team/islands-bridge/protocol";
```

Browser adapters mount a page cell with its shared app record.

```ts
import { mountMarimoIsland } from "@marimo-team/islands-bridge/browser";
import { pageCellPayload } from "@marimo-team/islands-bridge/protocol";

const cell = page.cells[0];
if (cell) mountMarimoIsland(host, pageCellPayload(page, cell));
```

Publishing hosts own source parsing, AST traversal, output placement, and framework lifecycle integration.

The bridge wraps the inner payload and reactive executor provided by
`@marimo-team/islands` with a page-level publishing contract. Every authored
cell keeps its own initial HTML while the page shares one runtime, asset set,
and notebook source.

## Styling

Import the shared stylesheet and map these tokens to the publishing host's theme.

```css
@import "@marimo-team/islands-bridge/styles.css";

.article {
  --marimo-island-background: var(--page-background);
  --marimo-island-foreground: var(--page-foreground);
  --marimo-island-accent: var(--primary);
}
```

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

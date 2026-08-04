# Architecture

A publishing host collects the marimo cells in a source document, compiles them
as one page, and places each compiled result back into the host document. In the
browser, the islands bridge mounts those results as one reactive marimo app.

```text
BUILD
  host source
  -> MarimoPageRequest
  -> CompiledMarimoPage
  -> payload for each authored cell
  -> host document

BROWSER
  host element
  -> islands bridge
  -> marimo runtime
  -> reactive cell
```

MDX, Quarto, and Jupyter Book have different source trees and browser hooks.
They use the same page protocol and browser bridge.

A **publishing host** compiles and renders a page. A **DOM host** is the
`HTMLElement` where the bridge mounts a cell.

## Package boundaries

| Package or system                   | Responsibility                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/islands-compiler`         | Host-neutral page compilation, cell planning, build-time evaluation, compiled metadata, and runtime asset extraction                             |
| `packages/islands-bridge`           | Page protocol, payload projection, DOM mounting, shared assets, app retention, navigation, theme propagation, custom elements, and shared styles |
| `packages/mdx-marimo`               | MDX authoring, mdast collection, page identity, compiler transport, MDX projection, React integration, and published package exports             |
| `@marimo-team/islands`              | Inner browser executor, worker, Pyodide environment, and reactive evaluation                                                                     |
| `docs`, `apps/docs`, and `examples` | Public documentation, documentation rendering, and host integration fixtures                                                                     |

`packages/islands-bridge` is private. Its API ships through:

- `@marimo-team/mdx-marimo/bridge/protocol`
- `@marimo-team/mdx-marimo/bridge/browser`
- `@marimo-team/mdx-marimo/bridge/element`
- `@marimo-team/mdx-marimo/bridge/styles.css`

The ownership direction is:

```text
islands-bridge <- mdx-marimo <- docs and host integrations
```

The `mdx-marimo` build emits the bridge source under those public subpaths. MDX
APIs remain under the package root, `remark`, `element`, `node`, `react`, and
`vitepress`.

[`packages/islands-compiler/compiler.py`](../packages/islands-compiler/compiler.py)
is the canonical Python page compiler. `mdx-marimo` packages it for the Node
adapter. Python publishing adapters vendor the same file and keep their process
runner and document projection in the host repository.

Bridge code depends on the page protocol, browser APIs, and marimo runtime
contracts. Publishing adapters own host syntax, tree nodes, CSS classes,
framework hooks, element names, host labels, and theme detection.

`@marimo-team/islands` is loaded from marimo-generated assets. It owns the
runtime inside each cell. The bridge owns the page lifecycle around it.

## Page protocol

[`packages/islands-bridge/src/protocol`](../packages/islands-bridge/src/protocol)
defines three page representations:

| Record                            | Producer           | Consumer        | Contents                                                                                          |
| --------------------------------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------------- |
| `MarimoPageRequest`               | Publishing host    | Page compiler   | Stable page identity, metadata, defaults, setup cells, and authored cells in source order         |
| `CompiledMarimoPage`              | Page compiler      | Publishing host | Shared app record, rendered cell HTML, effective options, build-time MIME output, and diagnostics |
| `MarimoPageSerializedCellPayload` | Payload projection | Browser bridge  | Browser cell fields with the shared app record or an `appId` reference                            |

Consumers validate `protocolVersion` before accepting a record.

Each compiled cell has `output: null` or an object with `mimetype`, JSON data,
and static HTML. Publishing hosts can map that output into native document
nodes. Payload projection selects the cell index, rendered island HTML,
effective options, and diagnostics for the browser.

`projectPageCellPayloads(page)` returns one position for each compiled cell:

1. The first included reactive cell carries the page app record.
2. Later included reactive cells carry an `appId` reference.
3. Included static cells carry `app: null`.
4. Excluded cells return `null`.

The publishing host maps those positions back to its document tree. The bridge
therefore controls the payload structure while each host controls its nodes.

## Build pipeline

### 1. Collect the source

The publishing host recognizes its syntax and creates one `MarimoPageRequest`
for the document. Collection owns:

- source-specific cell and configuration syntax
- document traversal
- source locations, diagnostics, and cell options
- setup cells, page metadata, and stable page identity
- replacement positions for authored cells

For MDX,
[`collectMarimoPage`](../packages/mdx-marimo/src/remark/collect.ts) walks mdast
code nodes and records marimo fences in source order.
[`pageRequest`](../packages/mdx-marimo/src/remark/identity.ts) creates the
public filename and stable identity.

Compilation is a document-level operation:

```text
one source document -> one MarimoPageRequest -> one marimo app
```

The request contains every setup cell and authored marimo cell in source order.
This gives the page one reactive graph, one runtime asset set, and one browser
lifecycle. A syntax plugin that encounters individual fences must first collect
them in a document transform. Compiling each fence independently creates
separate apps, so cells cannot share reactive dependencies and the browser
cannot replace the page as one lifecycle unit.

### 2. Compile the page

A page compiler accepts `MarimoPageRequest` and returns `CompiledMarimoPage`.
Each publishing adapter chooses its process boundary.

The MDX adapter calls
[`compileMarimoPage`](../packages/mdx-marimo/src/node/compile.ts). It resolves
`uv`, sends the request to the packaged Python compiler over standard input,
validates the JSON result, and caches it by request and compiler source.

[`compiler.py`](../packages/islands-compiler/compiler.py) creates the marimo
intermediate representation, evaluates the page at build time, and returns each
cell's rendered island HTML and MIME output with page runtime assets, browser
source, and diagnostics.

Setup cells participate in the dependency graph and have no authored output
position.

### 3. Project the cells

The publishing adapter calls `projectPageCellPayloads(page)` and places each
result at the matching source position. The bridge selects the app carrier,
creates references, preserves excluded positions, and encodes payloads as
base64url. The host constructs nodes and installs browser assets.

For MDX,
[`applyTreeEdits`](../packages/mdx-marimo/src/remark/edits.ts) replaces each
fence with an `mdxJsxFlowElement`.
[`marimoIslandNode`](../packages/mdx-marimo/src/mdx/nodes.ts) emits the element
name, host label, theme mode, app metadata, and encoded payload.

## Browser lifecycle

### 4. Connect the host

A publishing host uses the bridge entry that matches its browser lifecycle:

| Host lifecycle                                | Bridge entry                                         | Result                                                          |
| --------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| The host emits a custom element               | `defineMarimoIslandElement(options)`                 | Markup payloads mount when the element connects                 |
| The host receives a container while rendering | `mountMarimoIslandElement(parent, payload, options)` | The bridge creates or adopts an element and returns `release()` |
| The host owns a stable element                | `mountMarimoIsland(host, payload, options)`          | The bridge mounts a resolved payload and returns cleanup        |

`defineMarimoIslandElement` accepts the element definition options:

| Option          | Contract                                            |
| --------------- | --------------------------------------------------- |
| `name`          | Valid custom-element name                           |
| `host`          | Diagnostic and styling label for `data-marimo-host` |
| `themeResolver` | Maps a host theme signal to `light` or `dark`       |

`mountMarimoIslandElement` also accepts:

| Option               | Contract                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| `theme`              | Sets `auto`, `light`, or `dark` for the mounted element                 |
| `releaseDelayFrames` | Keeps an element available during a host replacement cycle              |
| `retentionKey`       | Identifies equivalent mounts when the app and cell key are insufficient |

### 5. Mount the cell

When a bridge custom element connects, it:

1. reads and validates the payload property or encoded markup
2. registers the resolved page app for the element lifetime
3. resolves an `appId` reference when the carrier is registered
4. mounts the build-time cell HTML
5. applies the configured theme
6. acquires a lease on the page app assets

A reference cell can connect before the carrier. It renders static HTML, waits
for app registration, then joins the page app.

`mountMarimoIslandElement` retains equivalent elements across host rerenders.
It matches by app and cell key, or `retentionKey`. Calling `release()` removes
the element after `releaseDelayFrames` unless another mount adopts it. A
reconnected element reactivates its existing app lease and refreshes its theme
from its new ancestor chain.

### 6. Activate the app

The browser asset lifecycle manages the document runtime and active app. It:

1. claims the runtime version and module set
2. installs shared head tags, links, and runtime payload
3. imports each runtime module once
4. serializes incoming activation with outgoing teardown
5. records the live host elements included in the activation
6. exposes activation readiness on each host lease

The bridge enables app replacement for marimo 0.23.16 and newer. Earlier
runtime versions keep full-document navigation.

Replacement-aware runtime modules expose:

```ts
canReplaceApp(): boolean
initialize(): Promise<void>
stopApp(appId?: string): Promise<void>
```

After the final outgoing lease is released, the bridge calls `stopApp`. The
next activation waits for teardown, installs its runtime context, and calls
`initialize`. The worker and Pyodide environment remain available.

A failed `stopApp` or a different runtime version or module set triggers a
document reload. The bridge retains full-document navigation until loaded
modules confirm app replacement support.

## Host adapters

| Publishing host | Collection                               | Projection                          | Browser connection                                           |
| --------------- | ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| MDX             | remark collects fences and configuration | mdast custom-element nodes          | Framework entry registers `marimo-mdx-island`                |
| Quarto          | Engine collects `.marimo` code fences    | Pandoc raw HTML blocks              | Header module registers an element and maps the Quarto theme |
| Jupyter Book    | MyST directives become document nodes    | anywidget nodes carry page payloads | anywidget render callback calls `mountMarimoIslandElement`   |

Quarto and Jupyter Book may use different compiler process boundaries. Their
browser code consumes the same bridge exports.

## Where code belongs

| Behavior                                                                   | Owner              |
| -------------------------------------------------------------------------- | ------------------ |
| Page protocol, DOM mounting, assets, themes, and shared lifecycle          | Islands bridge     |
| Host syntax, tree traversal, node emission, build hooks, and theme signals | Publishing adapter |
| Notebook evaluation, inner payload, worker, Pyodide, and app session       | marimo core        |

## Adding a publishing host

1. Collect the source document into `MarimoPageRequest`.
2. Invoke a compiler that returns a validated `CompiledMarimoPage`.
3. Call `projectPageCellPayloads` and preserve each output position.
4. Attach each payload through the host document representation.
5. Install `bridge/styles.css` once in the document.
6. Register a custom element or call `mountMarimoIslandElement`.
7. Supply a theme resolver and retention options required by the host lifecycle.
8. Validate static HTML, shared reactivity, theme changes, navigation,
   replacement, and teardown.

## Invariants

1. A source document produces one `MarimoPageRequest` and one marimo app.
2. Authored cells retain source order through compilation and projection.
3. A compiled page contains one result per authored cell.
4. Each compiled cell carries its build-time MIME output or `null`.
5. Browser payloads contain the fields needed to mount a cell.
6. Setup cells participate in evaluation and stay outside authored output
   positions.
7. App assets, notebook source, and runtime payload remain at page level.
8. Reactive cells on a page resolve the same stable app ID.
9. Build-time HTML appears before runtime activation completes.
10. Incoming activation waits for outgoing teardown.
11. Publishing adapters own element names, host labels, source nodes, build
    hooks, and host theme mapping.
12. Bridge source targets browser and marimo runtime contracts.
13. `element/auto` remains a self-contained browser entry with no bare workspace
    imports.
14. A protocol shape change updates `protocolVersion`, compilers, projection,
    browser consumers, and protocol tests together.

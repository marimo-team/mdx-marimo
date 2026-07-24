# Architecture

This repository compiles marimo cells embedded in MDX into static HTML and a
browser payload. The static HTML is visible in the built page. The browser
runtime later hydrates every cell on that page as one reactive marimo app.

## Package boundaries

```text
@marimo-team/islands-bridge
              ^
              |
@marimo-team/mdx-marimo
              ^
              |
       docs and examples
```

### `@marimo-team/islands-bridge`

`packages/islands-bridge` is the host-neutral layer. It owns:

- the page request, compiled page, cell, app, asset, and payload types
- outer page payload validation
- initial HTML mounting and inner runtime asset loading
- page-level app initialization
- custom-element creation
- theme detection and shadow-root theme bridging
- full-document navigation while islands are mounted
- shared layout, compatibility, and styling tokens

Publishing adapters consume its protocol and browser bridge directly. Source
parsing, AST traversal, and framework lifecycle integration stay in each
adapter.

`@marimo-team/islands` owns the inner islands payload and reactive browser
executor. `@marimo-team/islands-bridge` carries the outer page contract that
connects publishing source, compiled cells, host lifecycle, and that executor.

### `@marimo-team/mdx-marimo`

`packages/mdx-marimo` is the MDX adapter. It owns:

- marimo fence and option parsing
- mdast collection and replacement
- page identity derived from the source file or source content
- the Node-to-Python compiler transport and cache
- the conversion from `MarimoPageRequest` to marimo IR
- MDX custom-element nodes
- the React hydration entry
- the VitePress Markdown adapter

Framework examples configure these adapters through the host's Markdown or
MDX compiler and runtime entrypoints.

## End-to-end pipeline

```text
MDX source
  -> mdast tree
  -> collect every marimo fence and marimo-config fence
  -> MarimoPageRequest
  -> compileMarimoPage
  -> Python compiler process
  -> NotebookSerializationV1
  -> MarimoIslandGenerator._from_ir
  -> CompiledMarimoPage
  -> one marimo-mdx-island node per authored cell
  -> static host page
  -> custom element connects
  -> static HTML mounts immediately
  -> shared assets load once
  -> all page cells hydrate as one marimo app
```

### 1. Collect the page

[`collectMarimoPage`](../packages/mdx-marimo/src/remark/collect.ts) walks code
nodes in the mdast tree. It records each authored marimo cell in source order,
records the first `marimo-config` fence, and creates deferred tree edits.

[`pageRequest`](../packages/mdx-marimo/src/remark/identity.ts) adds the public
filename and stable page identity. The result is one `MarimoPageRequest` for the
whole page, even when ordinary MDX content appears between cells.

### 2. Cross the host-neutral protocol

[`protocol/index.ts`](../packages/islands-bridge/src/protocol/index.ts) defines
the compile-time boundary:

```text
MarimoPageRequest
  page identity
  page metadata and setup cells
  default cell options
  authored cells in source order

CompiledMarimoPage
  shared app identity and assets
  one compiled result per authored cell
  page and cell diagnostics
```

Protocol consumers validate `protocolVersion` before using a payload. A
breaking shape change requires a protocol version change and coordinated
updates to the compiler, MDX projection, runtime, and tests.

### 3. Run the Node compiler boundary

[`compileMarimoPage`](../packages/mdx-marimo/src/node/compile.ts) resolves `uv`,
starts the packaged Python compiler, writes the page request to standard input,
and validates the JSON result. The process timeout and cache directory are
public compiler options.

[`cache.ts`](../packages/mdx-marimo/src/node/cache.ts) hashes the serialized
request together with the Python compiler source. A compiler source change or a
request change therefore creates a new cache entry.

### 4. Map host IR to marimo IR

[`compile-page.py`](../packages/mdx-marimo/src/node/compile-page.py) plans each
cell, maps SQL and Markdown source to executable marimo source, and creates a
`NotebookSerializationV1` value through `to_marimo_ir`.

`MarimoIslandGenerator._from_ir` consumes that notebook IR directly. The
compiler executes the notebook once at build time, renders each authored cell,
collects shared browser assets, and generates notebook source for the browser
runtime.

Setup cells participate in the runtime graph but do not produce authored cell
outputs. SQL and Markdown conversions happen before the marimo IR boundary.

### 5. Project results back into MDX

[`applyTreeEdits`](../packages/mdx-marimo/src/remark/edits.ts) replaces each
authored fence with one MDX custom-element node. The node contains a
`MarimoPageCellPayload` with the shared app record and that cell's compiled
result.

Edits run in reverse tree order so replacing one node does not invalidate the
recorded indexes of later nodes.

### 6. Mount and hydrate in the browser

[`defineMarimoIslandElement`](../packages/islands-bridge/src/element/index.ts)
registers the custom element. It reads and validates the encoded payload, then
calls [`mountMarimoIsland`](../packages/islands-bridge/src/browser/island.ts).

Mounting writes the build-time HTML into the host before loading runtime
assets. [`ensureAssets`](../packages/islands-bridge/src/browser/assets.ts)
deduplicates links, head tags, module imports, and app initialization. The
theme bridge tracks the host theme while the island is connected.

## Invariants

Changes across the pipeline must preserve these contracts:

1. A source page produces one `MarimoPageRequest`.
2. Authored cells remain in source order from request through compiled result.
3. A compiled page returns exactly one cell result per authored cell.
4. Setup cells join the notebook graph and stay outside authored output placement.
5. App assets and notebook source live at page level, not on individual cells.
6. Every island on a page uses the same stable app ID.
7. Build-time HTML remains visible until browser hydration replaces or connects it.
8. Runtime assets and app initialization are deduplicated across page islands.
9. Host parsing and AST projection stay outside `islands-bridge`.
10. `element/auto` remains a self-contained browser entry with no bare workspace imports.

## Source map

| Responsibility                  | Owning source                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Protocol types and guards       | [`packages/islands-bridge/src/protocol`](../packages/islands-bridge/src/protocol)             |
| Browser app and asset lifecycle | [`packages/islands-bridge/src/browser`](../packages/islands-bridge/src/browser)               |
| Custom-element factory          | [`packages/islands-bridge/src/element`](../packages/islands-bridge/src/element)               |
| Shared CSS                      | [`packages/islands-bridge/src/styling`](../packages/islands-bridge/src/styling)               |
| Fence syntax and options        | [`packages/mdx-marimo/src/authoring`](../packages/mdx-marimo/src/authoring)                   |
| Page collection and MDX edits   | [`packages/mdx-marimo/src/remark`](../packages/mdx-marimo/src/remark)                         |
| Node compiler boundary          | [`packages/mdx-marimo/src/node`](../packages/mdx-marimo/src/node)                             |
| React hydration adapter         | [`packages/mdx-marimo/src/adapters/react`](../packages/mdx-marimo/src/adapters/react)         |
| VitePress Markdown adapter      | [`packages/mdx-marimo/src/adapters/vitepress`](../packages/mdx-marimo/src/adapters/vitepress) |
| Host integration fixtures       | [`examples`](../examples)                                                                     |

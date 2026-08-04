# AGENTS.md

Guidance for coding agents working in this pnpm and Vite+ workspace for
reactive marimo islands in publishing hosts.

Read [`development_docs/architecture.md`](./development_docs/architecture.md)
before changing package boundaries, protocol records, compilation, or browser
mounting. The remaining contributor docs are indexed in
[`development_docs/README.md`](./development_docs/README.md).

## Commands

Use Node 24 from [`.node-version`](./.node-version) and pnpm 11.10.0 from the
`packageManager` field in [`package.json`](./package.json).

```bash
corepack enable
pnpm install --frozen-lockfile
```

| Purpose       | Command      | Expected result                           |
| ------------- | ------------ | ----------------------------------------- |
| Static checks | `pnpm check` | Formatting, linting, and type checks pass |
| Tests         | `pnpm test`  | Bridge and MDX package tests pass         |
| Build         | `pnpm build` | Packages, docs, and examples build        |
| Full gate     | `pnpm ready` | Checks, tests, and builds pass            |

Build one package and its dependencies with:

```bash
pnpm exec vp run -t <package>#build
```

## Package boundaries

- `packages/islands-bridge` owns the page protocol and host-neutral browser
  bridge. It covers payload projection, DOM mounting, runtime assets, app
  retention, navigation, themes, custom elements, and shared styles.
- `packages/islands-compiler` owns host-neutral page compilation, cell
  planning, build-time evaluation, compiled metadata, and runtime asset
  extraction.
- `packages/mdx-marimo` owns MDX authoring and integration. It covers fence
  parsing, mdast collection, page identity, compiler transport, MDX projection,
  React and VitePress adapters, and published compiler and bridge artifacts.
- `@marimo-team/islands` owns the inner browser executor, worker, Pyodide
  environment, and reactive evaluation loaded through marimo-generated assets.
- `docs` contains public package documentation. `apps/docs` renders it.
  `examples` contains host integration fixtures.

The ownership direction is:

```text
islands-bridge <- mdx-marimo <- docs and host integrations
```

`packages/islands-bridge` is private. Its public contracts ship through
`@marimo-team/mdx-marimo/bridge/*`. Keep host syntax, host tree nodes, framework
hooks, element names, and host theme detection in adapters.

## Package invariants

- Keep exported subpaths explicit in each package `exports` map.
- Keep bridge implementation in `packages/islands-bridge` and publish it through
  `@marimo-team/mdx-marimo/bridge/*`.
- Keep the canonical Python compiler in `packages/islands-compiler/compiler.py`.
  Package it for MDX and vendor the same source into Python host adapters.
- Use extensionless relative imports in TypeScript source. The workspace uses
  `moduleResolution: "Bundler"`.
- Keep `@marimo-team/mdx-marimo/element/auto` self-contained with no bare
  workspace imports.
- Compile every source document as one request and one marimo app. Preserve one
  compiled result and one projected position per authored cell. Keep shared app
  assets at page level.
- Preserve stable app identity for the same document source, including builds
  that use temporary MDX filenames.
- Copy `packages/islands-compiler/compiler.py` to `dist/node/compiler.py`
  during the package build.
- Keep React as an optional peer dependency of the React adapter.
- Update `protocolVersion`, compilers, projection, browser consumers, and tests
  together when a protocol record changes.

## Documentation

- `docs` covers installation, host configuration, authoring, public APIs,
  styling, and examples.
- `apps/docs` owns documentation routes, components, styles, and source
  configuration.
- `development_docs` covers architecture, build mechanics, validation, and
  releases.
- `packages/mdx-marimo/README.md` ships to npm. Its examples must work from an
  installed package.

## Validation

Run `pnpm ready` for every package or framework boundary change. Also inspect
`pnpm pack:mdx --dry-run --json` when changing exports, build entries, copied
files, or package manifests.

Use browser checks for runtime, styling, navigation, and host integration
changes. Verify the Marimo Cloud blog integration when changing browser
mounting, MDX projection, shared CSS, or package exports.

Tests should assert protocol shapes, public behavior, generated package
contents, and runtime boundaries. Comments should explain lifecycle ordering,
serialization constraints, generated artifacts, or external runtime behavior.

# AGENTS.md

Guidance for coding agents working in this pnpm and Vite+ workspace for reactive marimo islands in MDX hosts.

Read [`development_docs/README.md`](./development_docs/README.md) for the
contributor documentation map. Read
[`development_docs/architecture.md`](./development_docs/architecture.md) before
changing package boundaries, protocol values, compilation, or browser mounting.

## Commands

| Purpose       | Command                          | Expected result                           |
| ------------- | -------------------------------- | ----------------------------------------- |
| Install       | `pnpm install --frozen-lockfile` | dependencies install successfully         |
| Static checks | `pnpm check`                     | formatting, linting, and type checks pass |
| Tests         | `pnpm test`                      | both package suites pass                  |
| Build         | `pnpm build`                     | packages, docs, and every example build   |
| Full gate     | `pnpm ready`                     | checks, tests, and builds pass            |

Vite+ (`vp`) owns formatting, linting, package builds, tests, and workspace task scheduling. Each package keeps the type checker that understands its generated files and framework conventions. Build one package and its dependencies with `pnpm exec vp run -t <package>#build`.

Keep shared build tools at the workspace root. The library packages are also linked into host workspaces for integration testing, so package-local tool dependencies would become part of each host's install policy.

## Documentation

- `docs` is the published documentation source for package users. Keep installation, host configuration, authoring, public APIs, styling, and examples there.
- `apps/docs` is the Fumadocs renderer. Keep site routes, components, styles, and source configuration there.
- `development_docs` is the contributor surface. Keep repository architecture, internal pipeline details, build mechanics, invariants, and validation procedures there.
- `packages/mdx-marimo/README.md` ships to npm. Its examples and explanations must work for consumers of the installed package.

## Architecture

- `packages/islands-bridge` defines the outer page protocol and browser bridge. It owns page and cell payload types, asset loading, app retention, navigation, theme bridging, custom-element creation, and shared styles.
- `@marimo-team/islands` owns the inner runtime payload and reactive browser executor loaded through the compiled page assets.
- `packages/mdx-marimo` adapts MDX authoring and host lifecycles. It owns fence parsing, mdast collection, page identity, compiler transport, MDX projection, and the React hydration adapter.
- A page is collected into one `MarimoPageRequest`, compiled into one `CompiledMarimoPage`, projected into host nodes, and mounted as one reactive marimo app.
- `docs` documents the public package. `apps/docs` renders the static documentation site. `examples/*` are integration fixtures for the supported host frameworks.
- The Python compiler script is packaged beside the Node entry that invokes it. `src/node/compile-page.py` must become `dist/node/compile-page.py`.

## Dependency Rule

Dependencies point from hosts toward the shared runtime:

```text
islands-bridge <- mdx-marimo <- docs and examples
```

`islands-bridge` contains the host-neutral publishing contract. `mdx-marimo` depends on that contract and adds MDX and React integration. Host fixtures belong in `apps/docs` or `examples`.

Workspace packages declare these relationships with `workspace:*`. `vp run -r build` uses that graph to build dependencies before consumers. Keep dependency scheduling out of package build scripts.

## Package Contracts

- Keep exported subpaths explicit in each package's `exports` map.
- `@marimo-team/mdx-marimo/element/auto` is a self-contained browser module with no bare package imports.
- Page compilation preserves one output entry per authored cell and keeps shared assets at page level.
- App identity is stable for the same document source, including builds that use temporary MDX filenames.
- `styles.css` is the public styling entry. Shared tokens and selectors remain owned by `islands-bridge`.
- React stays an optional peer dependency for the React hydration entry.

## Validation

Changes to package boundaries require all of these checks:

1. Run `pnpm ready`.
2. Inspect `pnpm pack:mdx --dry-run --json`.
3. Verify the docs and every example in a browser when runtime, styling, packaging, or host integration changes.
4. Verify the Marimo Cloud blog integration when changing exports, browser mounting, MDX projection, or workspace packaging.

Tests should assert public behavior, protocol shapes, generated package contents, and runtime boundaries. Use browser checks for visual appearance, progressive loading, navigation, and interaction. Comments should explain lifecycle constraints or invariants that the code does not make obvious.

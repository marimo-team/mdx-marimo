# Development

Run repository commands from the workspace root. The root owns Vite+,
TypeScript, and shared build tools.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
```

Use Node 24 from [`.node-version`](../.node-version) and the pnpm version pinned
in [`package.json`](../package.json). The workspace accepts Node 22.18 and newer.
Contributor workflows and CI use Node 24.

`@manzt/uv` supplies the default `uv` command when a compiler call has no
host-local executable.

## Commands

| Task                               | Command             |
| ---------------------------------- | ------------------- |
| Format, lint, and type checks      | `pnpm check`        |
| Tests                              | `pnpm test`         |
| Packages, docs, and example builds | `pnpm build`        |
| Complete local gate                | `pnpm ready`        |
| Apply formatting                   | `pnpm format`       |
| Check formatting                   | `pnpm format:check` |
| Type checks                        | `pnpm typecheck`    |

Build one package and its dependencies with Vite+:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo#build
```

Start one host package with a pnpm filter:

```bash
pnpm --filter @marimo-team/mdx-marimo-example-react dev
```

Start the documentation app:

```bash
pnpm --filter @marimo-team/mdx-marimo-docs dev
```

Open <http://127.0.0.1:4100>. The app `predev` script builds the local packages
before starting Vite.

## Vite+ tasks

[`packages/islands-bridge/vite.config.ts`](../packages/islands-bridge/vite.config.ts)
and
[`packages/mdx-marimo/vite.config.ts`](../packages/mdx-marimo/vite.config.ts)
define package build and type-check tasks. `vp run -r build` schedules workspace
builds and respects declared package dependencies.

Keep workspace scheduling in Vite+. Package scripts should expose a package
lifecycle command or native framework command.

## Package outputs

### `packages/islands-bridge`

The private bridge build emits ESM and declarations for:

- the package root
- `protocol`
- `browser`
- `element`

It also emits `styles.css`. Consumers install the bridge through
`@marimo-team/mdx-marimo`.

### `@marimo-team/mdx-marimo`

The published package emits ESM and declarations for:

- the package root
- `remark`
- `element`
- `node`
- `react`
- `vitepress`
- `bridge/protocol`
- `bridge/browser`
- `bridge/element`

The build also:

- bundles `element/auto` as a self-contained browser entry
- emits self-contained declarations for the bridge entries
- copies `packages/islands-compiler/compiler.py` to `dist/node/compiler.py`
- exposes one generated stylesheet through `styles.css` and `bridge/styles.css`

Update the package `exports` map and Vite+ entries together when adding or
renaming a public subpath.

## Host fixtures

Each example exercises a framework integration:

| Directory         | Integration                                               |
| ----------------- | --------------------------------------------------------- |
| `with-react`      | Vite, React, and `@mdx-js/react`                          |
| `with-vue`        | Vite, Vue, and `@mdx-js/vue`                              |
| `with-astro`      | Astro MDX and a client script                             |
| `with-next`       | Next.js MDX and a React runtime boundary                  |
| `with-docusaurus` | Docusaurus navigation and theme lifecycle                 |
| `with-nuxt`       | Nuxt Content and client registration                      |
| `with-vitepress`  | VitePress Markdown transformation and client registration |

Shared fixture styling lives in [`examples/site.css`](../examples/site.css).
Host-specific code covers compiler registration, browser registration, and
theme mapping.

## Generated files

Change source files and run the workspace build to regenerate `dist`, `.output`,
`.next`, `.nuxt`, `.astro`, `.docusaurus`, and example build directories.

The Python compiler under `packages/islands-compiler` is source. Its copy under
`dist/node` is a package artifact checked by the package build and dry-run
pack.

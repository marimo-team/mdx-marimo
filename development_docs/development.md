# Development

Run repository tooling from the workspace root. The root owns Vite+ and
TypeScript so the library packages can also be linked into another pnpm
workspace without adding this repository's build tools to the host's install
policy.

## Setup

```bash
pnpm install --frozen-lockfile
```

The root `package.json` requires Node 22.18 or newer and pins pnpm 11.10.0. CI
runs on the current Node 22 release. `@manzt/uv` supplies the `uv` command used
by the default page compiler when a host-local `uv` executable is unavailable.

## Commands

| Task                               | Command             |
| ---------------------------------- | ------------------- |
| Format and lint check              | `pnpm check`        |
| Unit and integration tests         | `pnpm test`         |
| Build packages, docs, and examples | `pnpm build`        |
| Complete local gate                | `pnpm ready`        |
| Apply formatting                   | `pnpm format`       |
| Check formatting                   | `pnpm format:check` |
| Run type checks                    | `pnpm typecheck`    |

Use Vite+ to target one package and its workspace dependencies:

```bash
pnpm exec vp run -t @marimo-team/mdx-marimo#build
```

Use a package filter for a host app:

```bash
pnpm --filter @marimo-team/mdx-marimo-example-react dev
```

## Task graph

The workspace dependency direction is:

```text
islands-bridge <- mdx-marimo <- docs and examples
```

[`packages/islands-bridge/vite.config.ts`](../packages/islands-bridge/vite.config.ts)
defines its `build` and `typecheck` tasks.
[`packages/mdx-marimo/vite.config.ts`](../packages/mdx-marimo/vite.config.ts)
defines the same tasks and declares that its build depends on dependency build
tasks. `vp run -r build` schedules the resulting graph.

Keep build ordering in the Vite+ graph. Package scripts should expose native
framework commands or true package lifecycle hooks, not repeat workspace
dependency filters.

## Package outputs

### Bridge workspace package

`vp pack` emits ESM and declarations for:

- the package root
- `protocol`
- `browser`
- `element`

It also copies `styles.css` and the CSS files under `src/styling` into `dist`.
These outputs are bundled into the `@marimo-team/mdx-marimo` npm tarball.

### `@marimo-team/mdx-marimo`

The main package build emits ESM and declarations for:

- the package root
- `remark`
- `element`
- `node`
- `react`

A second browser build bundles `element/auto` with `islands-bridge`, producing
a self-contained custom-element registration entry. The build copies
`src/node/compile-page.py` beside `dist/node/index.js` and copies the public
stylesheet to `dist/styles.css`. The npm tarball includes the versioned bridge
workspace dependency and its built files.

Update the package `exports` map and the Vite+ entries together when adding or
renaming a public subpath.

## Documentation surfaces

[`docs`](../docs) is the published package documentation. It covers
installation, framework configuration, authoring, public APIs, styling, and
runnable examples.

[`apps/docs`](../apps/docs) is the Fumadocs renderer. Its source configuration,
routes, components, and styles turn the repository documentation into the
static site.

[`development_docs`](.) records repository architecture and maintenance
contracts. Put package internals, build graph behavior, contributor workflows,
and test strategy here.

Package READMEs ship to npm. Keep their examples executable from an installed
package and keep repository maintenance instructions in this directory.

## Examples

Each example is an integration fixture for a native host path:

| Package           | Integration under test                         |
| ----------------- | ---------------------------------------------- |
| `with-react`      | Vite, React, and `@mdx-js/react`               |
| `with-vue`        | Vite, Vue, and `@mdx-js/vue`                   |
| `with-astro`      | Astro's MDX compiler and client script         |
| `with-next`       | Next.js MDX and a React runtime boundary       |
| `with-docusaurus` | Docusaurus docs navigation and theme lifecycle |
| `with-nuxt`       | Nuxt content, Vue MDX, and client registration |

Shared fixture styling lives in [`examples/site.css`](../examples/site.css).
Host-specific code should remain limited to compiler registration, runtime
registration, and host theme mapping.

## Generated files

Build output and framework caches are ignored. Change source files and let the
workspace commands regenerate `dist`, `.output`, `.next`, `.nuxt`, `.astro`,
`.docusaurus`, and example build directories.

The Python compiler is source. Its copied file under `dist/node` is a package
artifact and should be validated through the package build and dry-run pack.

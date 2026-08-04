# Validation

Choose checks from the boundary changed. Type checks cover package contracts.
Browser checks cover progressive rendering, hydration, theme changes,
navigation, and responsive layout.

## Complete gate

```bash
pnpm ready
```

`pnpm ready` runs:

1. formatting, linting, and package type checks
2. bridge and MDX package tests
3. bridge and MDX package builds
4. the Fumadocs production build
5. every framework example production build

Run the complete gate before handing off a change that crosses package or
framework boundaries.

## Package tests

`packages/islands-bridge/test` covers:

- protocol guards and payload construction
- custom-element mounting
- navigation retention and cleanup
- theme detection and propagation
- public styling and package metadata

`packages/mdx-marimo/test` covers:

- fence and option parsing
- page collection and MDX projection
- compiler request and result contracts
- Node compiler process behavior
- the React hydration adapter
- the VitePress Markdown adapter
- package exports

Prefer assertions through public functions, protocol values, emitted mdast
nodes, and mounted DOM behavior. Keep visual color, spacing, and responsive
claims in browser validation.

## Package publication

Inspect the package contents after changing build entries, copied files,
exports, or package manifests:

```bash
pnpm pack:mdx --dry-run --json
```

The root pack script runs the `mdx-marimo` `prepack` build. The package contains
the bridge implementation under `dist/bridge`.

Confirm these artifacts:

- every path in the `mdx-marimo` `exports` map has a corresponding JavaScript or CSS file
- every typed JavaScript subpath has a declaration file
- the bridge exports include their JavaScript, declarations, and shared styling
- `mdx-marimo` includes `dist/node/compiler.py`
- `mdx-marimo/element/auto` has no bare `@marimo-team/*` imports
- the published manifest has no runtime dependency on the private bridge package
- the `mdx-marimo` tarball installs in a fresh consumer project and imports every bridge subpath

`pnpm release:check` installs the tarball in a temporary consumer and imports
every public JavaScript subpath. When changing Vite+ task outputs, remove local
package `dist` directories and run a targeted build to confirm the task
recreates the complete package.

## Browser matrix

Browser validation should cover the docs app and every example:

| Surface    | Required behavior                                                             |
| ---------- | ----------------------------------------------------------------------------- |
| Fumadocs   | public setup and API pages render, islands hydrate, docs navigation works     |
| React      | three island hosts share one app and a control updates dependent output       |
| Vue        | three island hosts share one app and a control updates dependent output       |
| Astro      | static output appears before hydration and a control updates dependent output |
| Next.js    | the React boundary registers once and the page stays server-renderable        |
| Docusaurus | page navigation creates a page-scoped app and follows the host theme          |
| Nuxt       | the client registration hydrates all cells as one app                         |
| VitePress  | nested fences hydrate, page navigation creates separate apps, theme follows   |

Check both light and dark themes. Check a narrow mobile viewport and assert that
the document has no horizontal overflow. Inspect browser errors after hydration
and after navigation.

Progressive rendering requires two observations:

1. The custom-element host contains the compiled static HTML before the marimo
   runtime reaches its ready state.
2. The hydrated islands reach `idle`, share one app ID for the page, and remain
   interactive.

## Marimo Cloud

The marimo-cloud web app links the workspace packages during development.
Changes to package manifests, exports, the React runtime, MDX projection, or
shared CSS must also pass in a marimo-cloud checkout.

At minimum:

```bash
pnpm install
pnpm --filter @marimo-team/marimo-web typecheck
```

For runtime or styling changes, build and open the blog page that embeds
marimo islands. Verify static output, hydration, interaction, navigation, light
theme, dark theme, and mobile layout with a browser.

## Change matrix

| Change                           | Required validation                                               |
| -------------------------------- | ----------------------------------------------------------------- |
| Protocol types or guards         | both package tests, both builds, all host examples                |
| Python compiler or cell planning | compiler tests, package dry-run pack, interactive browser example |
| MDX collection or projection     | MDX tests, docs build, all framework builds                       |
| Browser assets or custom element | browser bridge tests, all browser examples, marimo-cloud          |
| Theme or shared CSS              | light and dark browser checks across all hosts and marimo-cloud   |
| Vite+ config or package exports  | `pnpm ready`, clean package builds, package dry-run pack          |
| Framework adapter                | that framework's build, desktop browser flow, mobile dark flow    |

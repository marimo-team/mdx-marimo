# Development documentation

These documents describe how to change and validate this repository.

- [`architecture.md`](./architecture.md) maps the packages, compile-time pipeline, browser lifecycle, and ownership boundaries.
- [`development.md`](./development.md) covers workspace commands, Vite+ task scheduling, package outputs, and local development.
- [`releasing.md`](./releasing.md) covers package versioning, release tags, workflow behavior, and registry verification.
- [`validation.md`](./validation.md) defines the checks required for protocol, packaging, framework, and browser changes.

Package installation, authoring syntax, public APIs, and styling belong in
[`docs`](../docs). The Fumadocs app in [`apps/docs`](../apps/docs) renders that
content. Keep repository mechanics here so the published documentation stays
focused on people integrating `@marimo-team/mdx-marimo` into a site.

Start with [`architecture.md`](./architecture.md) before changing package
boundaries or the page protocol. Read [`validation.md`](./validation.md) before
changing compilation, browser mounting, styling, or framework adapters.

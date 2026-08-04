# Development documentation

- [`architecture.md`](./architecture.md) defines package ownership, the page
  protocol, build stages, and browser lifecycle.
- [`development.md`](./development.md) covers setup, workspace commands, package
  builds, and local host fixtures.
- [`validation.md`](./validation.md) maps changes to package, browser, and
  integration checks.
- [`releasing.md`](./releasing.md) covers versioning, release tags, publication,
  and registry verification.

Read [`architecture.md`](./architecture.md) before changing package boundaries
or protocol records. Read [`validation.md`](./validation.md) before changing
compilation, browser mounting, styling, or host adapters.

User documentation lives in [`docs`](../docs) and is rendered by
[`apps/docs`](../apps/docs).

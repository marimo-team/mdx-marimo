# Contributing to mdx-marimo

Contributions are made through pull requests. Discuss substantial changes in a
[GitHub issue](https://github.com/marimo-team/mdx-marimo/issues) before
implementation. This includes changes to public APIs, the page protocol,
package boundaries, dependencies, supported hosts, CI, or releases.

## Setup

Use Node 24 from [`.node-version`](./.node-version) and the pnpm version pinned
in [`package.json`](./package.json).

```bash
corepack enable
pnpm install --frozen-lockfile
```

Run workspace commands from the repository root. The
[development documentation](./development_docs/README.md) covers package
ownership, targeted commands, generated files, and validation requirements.

## Pull requests

Before opening a pull request:

1. Keep the change within the owning package, renderer, or host fixture.
2. Add tests for new behavior and regression tests for bug fixes.
3. Update public documentation or package READMEs when the installed package
   contract changes.
4. Run `pnpm ready`.
5. Complete the package or browser checks required by the
   [validation matrix](./development_docs/validation.md#change-matrix).

In the pull request, describe the supported behavior, affected boundaries, and
the checks you ran.

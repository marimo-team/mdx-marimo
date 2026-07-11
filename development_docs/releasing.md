# Releasing `@marimo-team/mdx-marimo`

Push a tag named `v<version>` to publish the matching package version. The
workflow checks the workspace, packs one npm tarball, publishes that artifact
through npm trusted publishing, then updates the GitHub release with
`changelogithub`.

## Prepare a release

1. Set `packages/mdx-marimo/package.json` to the release version.
2. Run the release checks:

   ```bash
   pnpm ready
   pnpm pack:mdx --dry-run --json
   ```

3. Merge the release commit to `main`.

## Publish

Create the release tag on the release commit and push it:

```bash
git tag -a v0.0.1 -m "Release 0.0.1"
git push origin v0.0.1
```

The build job runs `pnpm ready` and packs the tarball once. The publish job
downloads that artifact and passes it directly to `npm publish`. The
release-notes job runs after npm accepts the package.

## Verify

Confirm the registry version and the GitHub release after the workflow passes:

```bash
npm view @marimo-team/mdx-marimo@0.0.1 version dist.integrity dist.tarball
gh release view v0.0.1
```

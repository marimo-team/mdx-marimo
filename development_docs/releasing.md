# Releasing `@marimo-team/mdx-marimo`

A `v<version>` tag publishes the matching package version. Stable versions use
the npm `latest` tag. Prerelease versions use `next`.

The publish workflow checks the tag against `packages/mdx-marimo/package.json`,
builds and validates one npm tarball, publishes that tarball through npm trusted
publishing, and updates the GitHub release.

## Inspect versions

Read the local package versions and the current npm release:

```bash
pnpm --filter @marimo-team/mdx-marimo pkg get name version
npm view @marimo-team/mdx-marimo version dist-tags --json
```

Set an explicit package version when preparing a release:

```bash
VERSION=0.0.3
pnpm release:version "$VERSION"
```

Use an explicit prerelease version when publishing a release candidate:

```bash
VERSION=0.0.3-rc.0
pnpm release:version "$VERSION"
```

The version command updates the published package manifest for review and
leaves the release commit and tag to the maintainer.

## Prepare a release

1. Set the package version when the current manifest does not already contain
   the release version.
2. Run the release check:

   ```bash
   pnpm release:check
   ```

   This runs the complete workspace gate, builds `dist/npm/*.tgz`, installs that
   tarball in a temporary consumer project, and imports every public JavaScript
   subpath.

3. Commit the version change when needed, merge it to `main`, and wait for CI
   to pass.

4. Confirm the npm trusted publisher for `@marimo-team/mdx-marimo` allows:

   ```bash
   npx --yes npm@11.12.1 trust list @marimo-team/mdx-marimo
   ```

   - GitHub organization: `marimo-team`
   - Repository: `mdx-marimo`
   - Workflow: `publish.yml`
   - Environment: `npm`
   - Action: `npm publish`

   The trust record requires npm package owner access to inspect or change.

## Publish

Create the release tag on the release commit and push it:

```bash
VERSION=$(node -p "require('./packages/mdx-marimo/package.json').version")
git tag -a "v${VERSION}" -m "Release ${VERSION}"
git push origin "v${VERSION}"
```

The build job runs `pnpm release:check`. The publish job downloads the validated
artifact and passes it directly to `npm publish`. The release-notes job runs
after npm accepts the package.

## Verify

Confirm the registry version, dist-tag, and GitHub release after the workflow
passes:

```bash
VERSION=$(node -p "require('./packages/mdx-marimo/package.json').version")
npm view "@marimo-team/mdx-marimo@${VERSION}" version dist.integrity dist.tarball
npm view @marimo-team/mdx-marimo dist-tags --json
gh release view "v${VERSION}"
```

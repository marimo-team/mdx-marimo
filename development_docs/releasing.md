# Releasing `@marimo-team/mdx-marimo`

Push a tag named `v<version>` to publish the matching package version. Stable
versions use the npm `latest` tag. Prerelease versions use `next`. The workflow
checks the tag against the package version, validates one npm tarball, publishes
that artifact through npm trusted publishing, then updates the GitHub release
with `changelogithub`.

## Inspect versions

Read the local package versions and the current npm release:

```bash
pnpm --filter @marimo-team/mdx-marimo pkg get name version
pnpm --filter @marimo-team/islands-bridge pkg get name version
npm view @marimo-team/mdx-marimo version dist-tags --json
```

`mdx-marimo` and its bundled `islands-bridge` package use the same version. Set
an explicit version for both packages when preparing a later release:

```bash
pnpm release:version 0.0.2
```

Use an explicit prerelease version when publishing a release candidate:

```bash
pnpm release:version 0.0.2-rc.0
```

The recursive version command updates the package manifests for review and
leaves the release commit and tag to the maintainer.

## Prepare a release

1. Set the package version when the current manifests do not already contain the
   release version.
2. Run the release check:

   ```bash
   pnpm release:check
   ```

   This runs the complete workspace gate, builds `dist/npm/*.tgz`, installs that
   tarball in a temporary consumer project, and imports every public JavaScript
   subpath.

3. Commit the version change when needed, merge the release commit to `main`,
   and wait for CI to pass.

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
git tag -a v0.0.1 -m "Release 0.0.1"
git push origin v0.0.1
```

The build job runs `pnpm release:check`. The publish job downloads the validated
artifact and passes it directly to `npm publish`. The release-notes job runs
after npm accepts the package.

## Verify

Confirm the registry version, dist-tag, and GitHub release after the workflow
passes:

```bash
npm view @marimo-team/mdx-marimo@0.0.1 version dist.integrity dist.tarball
npm view @marimo-team/mdx-marimo dist-tags --json
gh release view v0.0.1
```

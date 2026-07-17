# Examples

These examples add reactive marimo cells to MDX pages in several hosts.
Each folder contains a runnable integration.

| Host           | Example                                |
| -------------- | -------------------------------------- |
| Astro          | [`with-astro`](./with-astro)           |
| Docusaurus     | [`with-docusaurus`](./with-docusaurus) |
| Next.js        | [`with-next`](./with-next)             |
| Nuxt           | [`with-nuxt`](./with-nuxt)             |
| React and Vite | [`with-react`](./with-react)           |
| Vue and Vite   | [`with-vue`](./with-vue)               |

Use the same integration pattern with any host that supports
[MDX](https://mdxjs.com/): add `remarkMarimo` to the host's MDX compiler, load
the package stylesheet, and register the browser runtime. See
[framework setup](../docs/api/frameworks.mdx) for the shared contract.

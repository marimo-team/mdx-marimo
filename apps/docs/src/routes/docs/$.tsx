import { createDocsLink, getMDXComponents } from "@/components/mdx";
import { getPageDirectory, source } from "@/lib/source";
import { staticFunctionMiddleware } from "@/lib/static-function-middleware";
import { baseOptions } from "@/lib/layout.shared";
import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import browserCollections from "collections/browser";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { Suspense } from "react";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    const data = await loadPage({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

const loadPage = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      directory: getPageDirectory(page.path),
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    {
      directory,
    }: {
      directory: string[];
    },
  ) {
    return (
      <DocsPage toc={toc} full={frontmatter.full}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents({ a: createDocsLink(directory) })} />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const { pageTree, path, directory } = useFumadocsLoader(Route.useLoaderData());

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Suspense>
        {clientLoader.useContent(path, { directory })}
        <MarimoIslandRuntime />
      </Suspense>
    </DocsLayout>
  );
}

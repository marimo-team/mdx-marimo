import { docsRoute } from "@/lib/shared";
import Link from "fumadocs-core/link";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { AnchorHTMLAttributes, FC } from "react";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
  } satisfies MDXComponents;
}

export function createDocsLink(directory: string[]): FC<AnchorHTMLAttributes<HTMLAnchorElement>> {
  function DocsLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <Link href={resolveDocsHref(href, directory)} {...props} />;
  }

  return DocsLink;
}

function resolveDocsHref(href: string | undefined, directory: string[]) {
  if (!href || href.startsWith("#") || href.startsWith("/") || /^\w+:|^\/\//.test(href)) {
    return href;
  }

  const [pathWithQuery, hash] = href.split("#", 2);
  const [pathname, query] = pathWithQuery.split("?", 2);
  if (!pathname.endsWith(".md")) return href;

  const segments = [...directory];
  for (const part of pathname.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }

    segments.push(part);
  }

  const last = segments.at(-1);
  if (last?.endsWith(".md")) segments[segments.length - 1] = last.slice(0, -3);
  if (segments.at(-1) === "index") segments.pop();

  const path = segments.length > 0 ? `${docsRoute}/${segments.join("/")}` : docsRoute;
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

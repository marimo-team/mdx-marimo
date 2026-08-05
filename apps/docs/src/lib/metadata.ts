import { appName, brandAssets } from "@/lib/shared";
import type { MetaHTMLAttributes } from "react";

export const siteUrl = "https://marimo-team.github.io/mdx-marimo/";
export const siteTagline = "Run marimo wherever MDX runs.";
export const siteTitle = "mdx-marimo: Run marimo wherever MDX runs";
export const siteDescription =
  "Compose reactive Python, SQL, and Markdown cells inside documentation, tutorials, and articles.";

export const socialImageUrl = resolveSiteUrl(brandAssets.openGraph);
export const socialImageAlt = `${appName}: ${siteTagline}`;

type MetadataOptions = {
  title?: string;
  description?: string;
  url?: string;
};

export function createMetadata({
  title = siteTitle,
  description = siteDescription,
  url = siteUrl,
}: MetadataOptions = {}): MetaHTMLAttributes<HTMLMetaElement>[] {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: appName },
    { property: "og:image", content: socialImageUrl },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "2400" },
    { property: "og:image:height", content: "1260" },
    { property: "og:image:alt", content: socialImageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: socialImageUrl },
    { name: "twitter:image:alt", content: socialImageAlt },
  ];
}

export function createPageTitle(title: string) {
  return title === appName ? siteTitle : `${title} | ${appName}`;
}

export function resolveSiteUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ""), siteUrl).toString();
}

export function resolvePageUrl(pathname: string) {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  return resolveSiteUrl(`${path}/`);
}

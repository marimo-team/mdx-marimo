import { withBasePath } from "@/lib/base-path";
import { appName, brandAssets, docsRoute, gitConfig } from "@/lib/shared";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <span aria-hidden="true" className="shrink-0">
            <img
              alt=""
              className="size-8 dark:hidden"
              height={32}
              src={withBasePath(brandAssets.mark.light.svg)}
              width={32}
            />
            <img
              alt=""
              className="hidden size-8 dark:block"
              height={32}
              src={withBasePath(brandAssets.mark.dark.svg)}
              width={32}
            />
          </span>
          <span
            aria-label={appName}
            className="inline-flex items-baseline text-base font-bold leading-none tracking-[-0.035em]"
          >
            <span className="text-(--mdx-marimo-mdx)">mdx</span>
            <span className="text-fd-foreground">-</span>
            <span className="text-(--mdx-marimo-marimo)">marimo</span>
          </span>
        </>
      ),
      url: docsRoute,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

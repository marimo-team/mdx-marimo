import { createRootRoute, HeadContent, Outlet, Scripts, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import SearchDialog from "@/components/search";
import { withBasePath } from "@/lib/base-path";
import appCss from "@/styles/app.css?url";
import { FrameworkProvider, type Framework, type Router } from "fumadocs-core/framework";
import { RootProvider } from "fumadocs-ui/provider/base";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "mdx-marimo",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <FrameworkProvider
          Link={DocsLink}
          useParams={useDocsParams}
          usePathname={useDocsPathname}
          useRouter={useDocsRouter}
        >
          <RootProvider search={{ SearchDialog }}>
            <MarimoRuntime />
            <Outlet />
          </RootProvider>
        </FrameworkProvider>
        <Scripts />
      </body>
    </html>
  );
}

const DocsLink: NonNullable<Framework["Link"]> = ({ href, prefetch: _prefetch, ...props }) => {
  return <a href={href ? withBasePath(href) : href} {...props} />;
};

function useDocsPathname() {
  return useRouterState({ select: (state) => state.location.pathname });
}

function useDocsParams() {
  return useParams({ strict: false }) as Record<string, string | string[]>;
}

function useDocsRouter(): Router {
  return useMemo(
    () => ({
      push(url) {
        window.location.assign(withBasePath(url));
      },
      refresh() {
        window.location.reload();
      },
    }),
    [],
  );
}

function MarimoRuntime() {
  useEffect(() => {
    void import("@marimo-team/mdx-marimo/element/auto");
  }, []);

  return null;
}

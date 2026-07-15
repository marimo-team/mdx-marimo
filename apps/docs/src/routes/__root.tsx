import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import SearchDialog from "@/components/search";
import { withBasePath } from "@/lib/base-path";
import appCss from "@/styles/app.css?url";
import type { Framework } from "fumadocs-core/framework";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

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
        <RootProvider components={{ Link: DocsLink }} search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}

const DocsLink: NonNullable<Framework["Link"]> = ({ href, prefetch: _prefetch, ...props }) => {
  return <a href={href ? withBasePath(href) : href} {...props} />;
};

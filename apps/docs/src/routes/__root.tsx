import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import SearchDialog from "@/components/search";
import { withBasePath } from "@/lib/base-path";
import { createMetadata } from "@/lib/metadata";
import { appName, brandAssets } from "@/lib/shared";
import appCss from "@/styles/app.css?url";
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
      ...createMetadata(),
      {
        name: "application-name",
        content: appName,
      },
      {
        name: "theme-color",
        content: "#1d7363",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: withBasePath(brandAssets.mark.light.svg),
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
        href: withBasePath(brandAssets.mark.dark.svg),
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "1024x1024",
        href: withBasePath(brandAssets.mark.light.png),
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "1024x1024",
        media: "(prefers-color-scheme: dark)",
        href: withBasePath(brandAssets.mark.dark.png),
      },
      {
        rel: "apple-touch-icon",
        sizes: "1024x1024",
        href: withBasePath(brandAssets.mark.light.png),
      },
    ],
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
        <RootProvider search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}

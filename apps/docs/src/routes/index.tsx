import { baseOptions } from "@/lib/layout.shared";
import { withBasePath } from "@/lib/base-path";
import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-20">
        <p className="mb-3 text-sm font-medium text-fd-muted-foreground">mdx-marimo</p>
        <h1 className="text-4xl font-semibold tracking-tight">Render marimo notebook islands from MDX.</h1>
        <p className="mt-4 text-lg text-fd-muted-foreground">
          The docs site compiles marimo fences with Fumadocs, renders static marimo islands, and
          exports static files for CDN hosting.
        </p>
        <div className="mt-8">
          <a
            href={withBasePath("/docs")}
            className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
          >
            Open the docs
          </a>
        </div>
      </main>
    </HomeLayout>
  );
}

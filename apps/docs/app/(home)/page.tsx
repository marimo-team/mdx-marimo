import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-20">
      <p className="mb-3 text-sm font-medium text-fd-muted-foreground">mdx-marimo</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Render marimo notebook islands from MDX.
      </h1>
      <p className="mt-4 text-lg text-fd-muted-foreground">
        The docs site compiles marimo fences with Fumadocs, renders static marimo islands, and
        exports as plain files for GitHub Pages.
      </p>
      <div className="mt-8">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Open the docs
        </Link>
      </div>
    </main>
  );
}

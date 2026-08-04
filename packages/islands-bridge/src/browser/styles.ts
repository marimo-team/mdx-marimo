export function installMarimoIslandStyles(
  href: string,
  target: Document = document,
): HTMLLinkElement {
  if (!href.trim()) {
    throw new TypeError("Marimo island stylesheet URL must not be empty");
  }

  const resolvedHref = target.baseURI ? new URL(href, target.baseURI).href : new URL(href).href;
  const existing = Array.from(
    target.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).find((link) => link.href === resolvedHref);
  if (existing) return existing;

  const link = target.createElement("link");
  link.rel = "stylesheet";
  link.href = resolvedHref;
  link.dataset.marimoIslandStyles = "true";
  target.head.append(link);
  return link;
}

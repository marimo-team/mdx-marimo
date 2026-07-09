export function withBasePath(href: string) {
  const basePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!basePath || !href.startsWith("/") || href === basePath || href.startsWith(`${basePath}/`)) {
    return href;
  }

  return `${basePath}${href}`;
}

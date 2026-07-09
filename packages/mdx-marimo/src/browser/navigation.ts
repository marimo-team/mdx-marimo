let documentNavigationStarted = false;

export function ensureDocumentNavigation(): void {
  if (documentNavigationStarted) return;
  documentNavigationStarted = true;

  installHistoryNavigation();
  document.addEventListener(
    "click",
    (event) => {
      const anchor = closestAnchor(event.target);
      if (!anchor || !shouldUseDocumentNavigation(event, anchor)) return;

      event.preventDefault();
      window.location.assign(anchor.href);
    },
    true,
  );
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

function installHistoryNavigation(): void {
  if (typeof history === "undefined") return;

  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<History["pushState"]>) => {
    const url = documentNavigationUrl(args[2]);
    if (url) {
      window.location.assign(url.href);
      return;
    }
    return pushState(...args);
  }) as History["pushState"];

  history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
    const url = documentNavigationUrl(args[2]);
    if (url) {
      window.location.replace(url.href);
      return;
    }
    return replaceState(...args);
  }) as History["replaceState"];
}

function shouldUseDocumentNavigation(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  return documentNavigationUrl(anchor.href) !== undefined;
}

function documentNavigationUrl(href: string | URL | null | undefined): URL | undefined {
  if (href === undefined || href === null) return undefined;

  let url: URL;
  try {
    url = new URL(href, document.baseURI);
  } catch {
    return undefined;
  }

  if (url.origin !== window.location.origin) return undefined;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return undefined;
  }
  return url;
}

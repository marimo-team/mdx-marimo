let documentNavigationStarted = false;

export function ensureDocumentNavigation(): void {
  if (documentNavigationStarted) return;
  documentNavigationStarted = true;

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

function shouldUseDocumentNavigation(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, document.baseURI);
  if (url.origin !== window.location.origin) return false;

  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

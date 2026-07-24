type NavigationState = {
  click: (event: MouseEvent) => void;
  originalPushState: History["pushState"];
  originalReplaceState: History["replaceState"];
  pushState: History["pushState"];
  references: number;
  replaceState: History["replaceState"];
};

type NavigationDocumentState = {
  lease?: NavigationState;
};

const navigationStateSymbol = Symbol.for("@marimo-team/islands-bridge/navigation-state");

// Keep document navigation active until the loaded runtime confirms that it
// can replace the current page app and release its session during route changes.
export function retainDocumentNavigation(): () => void {
  if (typeof document === "undefined" || typeof history === "undefined") return () => {};

  const documentState = navigationDocumentState();
  if (documentState.lease) {
    documentState.lease.references += 1;
    return releaseOnce(documentState.lease);
  }

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  const click = (event: MouseEvent) => {
    const anchor = closestAnchor(event.target);
    if (!anchor || !shouldUseDocumentNavigation(event, anchor)) return;

    event.preventDefault();
    window.location.assign(anchor.href);
  };
  const pushState: History["pushState"] = function (...args) {
    const url = documentNavigationUrl(args[2]);
    if (url) {
      window.location.assign(url.href);
      return;
    }
    return originalPushState(...args);
  };
  const replaceState: History["replaceState"] = function (...args) {
    const url = documentNavigationUrl(args[2]);
    if (url) {
      window.location.replace(url.href);
      return;
    }
    return originalReplaceState(...args);
  };

  const lease = {
    click,
    originalPushState,
    originalReplaceState,
    pushState,
    references: 1,
    replaceState,
  };
  documentState.lease = lease;
  history.pushState = pushState;
  history.replaceState = replaceState;
  document.addEventListener("click", click, true);

  return releaseOnce(lease);
}

function navigationDocumentState(): NavigationDocumentState {
  const target = window as typeof window & {
    [key: symbol]: NavigationDocumentState | undefined;
  };
  return (target[navigationStateSymbol] ??= {});
}

function releaseOnce(lease: NavigationState): () => void {
  let released = false;
  return () => {
    const documentState = navigationDocumentState();
    if (released || documentState.lease !== lease) return;
    released = true;
    lease.references -= 1;
    if (lease.references > 0) return;

    document.removeEventListener("click", lease.click, true);
    if (history.pushState === lease.pushState) history.pushState = lease.originalPushState;
    if (history.replaceState === lease.replaceState) {
      history.replaceState = lease.originalReplaceState;
    }
    delete documentState.lease;
  };
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

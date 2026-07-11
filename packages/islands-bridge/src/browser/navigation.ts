type NavigationState = {
  click: (event: MouseEvent) => void;
  originalPushState: History["pushState"];
  originalReplaceState: History["replaceState"];
  pushState: History["pushState"];
  references: number;
  replaceState: History["replaceState"];
};

let state: NavigationState | undefined;

// The marimo islands runtime discovers one page of apps when it starts.
// Full-document navigation gives the next MDX page a fresh runtime registry.
export function retainDocumentNavigation(): () => void {
  if (typeof document === "undefined" || typeof history === "undefined") return () => {};

  if (state) {
    state.references += 1;
    return releaseOnce();
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

  state = {
    click,
    originalPushState,
    originalReplaceState,
    pushState,
    references: 1,
    replaceState,
  };
  history.pushState = pushState;
  history.replaceState = replaceState;
  document.addEventListener("click", click, true);

  return releaseOnce();
}

function releaseOnce(): () => void {
  let released = false;
  return () => {
    if (released || !state) return;
    released = true;
    state.references -= 1;
    if (state.references > 0) return;

    document.removeEventListener("click", state.click, true);
    if (history.pushState === state.pushState) history.pushState = state.originalPushState;
    if (history.replaceState === state.replaceState) {
      history.replaceState = state.originalReplaceState;
    }
    state = undefined;
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

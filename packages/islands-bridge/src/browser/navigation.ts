type NavigationState = {
  click: (event: MouseEvent) => void;
  originalPushState: History["pushState"];
  originalReplaceState: History["replaceState"];
  popstate: (event: PopStateEvent) => void;
  pushState: History["pushState"];
  references: number;
  replaceState: History["replaceState"];
};

type NavigationDocumentState = {
  lease?: NavigationState;
};

type NavigationPlatform = {
  document?: Document;
  history?: History;
  window?: Window;
};

type NavigationRuntime = {
  document: Document;
  history: History;
  window: Window;
};

const navigationStateSymbol: unique symbol = Symbol.for(
  "@marimo-team/islands-bridge/navigation-state",
);

declare global {
  interface Window {
    [navigationStateSymbol]?: NavigationDocumentState;
  }
}

// Keep document navigation active until the loaded runtime confirms that it
// can replace the current page app and release its session during route changes.
export function retainDocumentNavigation(): () => void {
  const runtime = navigationRuntime();
  if (!runtime) return () => {};

  const { document, history, window } = runtime;
  const documentState = navigationDocumentState(window);
  if (documentState.lease) {
    documentState.lease.references += 1;
    return releaseOnce(documentState.lease, runtime);
  }

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  const click = (event: MouseEvent) => {
    const anchor = closestAnchor(event.target);
    if (!anchor || !shouldUseDocumentNavigation(event, anchor, runtime)) return;

    event.preventDefault();
    window.location.assign(anchor.href);
  };
  const pushState: History["pushState"] = function (...args) {
    const url = documentNavigationUrl(args[2], runtime);
    if (url) {
      window.location.assign(url.href);
      return;
    }
    return originalPushState(...args);
  };
  const replaceState: History["replaceState"] = function (...args) {
    const url = documentNavigationUrl(args[2], runtime);
    if (url) {
      window.location.replace(url.href);
      return;
    }
    return originalReplaceState(...args);
  };
  const popstate = (event: PopStateEvent) => {
    event.stopImmediatePropagation();
    window.location.reload();
  };

  const lease = {
    click,
    originalPushState,
    originalReplaceState,
    popstate,
    pushState,
    references: 1,
    replaceState,
  };
  documentState.lease = lease;
  history.pushState = pushState;
  history.replaceState = replaceState;
  document.addEventListener("click", click, true);
  window.addEventListener("popstate", popstate, true);

  return releaseOnce(lease, runtime);
}

function navigationRuntime(): NavigationRuntime | undefined {
  const platform: NavigationPlatform = globalThis;
  if (!platform.document || !platform.history || !platform.window) return undefined;
  return {
    document: platform.document,
    history: platform.history,
    window: platform.window,
  };
}

function navigationDocumentState(target: Window): NavigationDocumentState {
  return (target[navigationStateSymbol] ??= {});
}

function releaseOnce(lease: NavigationState, runtime: NavigationRuntime): () => void {
  let released = false;
  return () => {
    const { document, history, window } = runtime;
    const documentState = navigationDocumentState(window);
    if (released || documentState.lease !== lease) return;
    released = true;
    lease.references -= 1;
    if (lease.references > 0) return;

    document.removeEventListener("click", lease.click, true);
    window.removeEventListener("popstate", lease.popstate, true);
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

function shouldUseDocumentNavigation(
  event: MouseEvent,
  anchor: HTMLAnchorElement,
  runtime: NavigationRuntime,
): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  return documentNavigationUrl(anchor.href, runtime) !== undefined;
}

function documentNavigationUrl(
  href: string | URL | null | undefined,
  runtime: NavigationRuntime,
): URL | undefined {
  if (href === undefined || href === null) return undefined;

  let url: URL;
  try {
    url = new URL(href, runtime.document.baseURI);
  } catch {
    return undefined;
  }

  if (url.origin !== runtime.window.location.origin) return undefined;
  if (
    url.pathname === runtime.window.location.pathname &&
    url.search === runtime.window.location.search
  ) {
    return undefined;
  }
  return url;
}

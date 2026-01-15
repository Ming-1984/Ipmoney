type DomGuardOptions = {
  overlayIds: readonly string[];
};

function isH5Dev() {
  return process.env.TARO_ENV === 'h5' && process.env.NODE_ENV !== 'production';
}

function schedule(fn: () => void) {
  if (typeof window === 'undefined') return;
  window.setTimeout(fn, 0);
}

function getRouterEl() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.taro_router');
}

function warn(lines: string[]) {
  if (typeof console === 'undefined') return;
  // eslint-disable-next-line no-console
  console.warn(['[dom-guard]', ...lines].join('\n'));
}

function checkDom(options: DomGuardOptions) {
  const routerEl = getRouterEl();
  if (!routerEl) {
    warn(['Missing `.taro_router` (Taro H5 router root).']);
    return;
  }

  const pages = Array.from(routerEl.querySelectorAll('.taro_page'));
  if (!pages.length) {
    warn(['Missing `.taro_page` under `.taro_router` (no page container found).']);
    return;
  }

  const lastPage = pages[pages.length - 1] as HTMLElement;
  const lastChild = routerEl.lastElementChild as HTMLElement | null;
  if (lastChild && lastChild !== lastPage && !lastChild.classList.contains('taro_page')) {
    warn([
      'The last child of `.taro_router` is not a `.taro_page`.',
      'This may cause page hidden/white screen if CSS relies on `:last-child` for page visibility.',
      `- router.lastChild: <${lastChild.tagName.toLowerCase()} class="${lastChild.className}">`,
      `- lastPage: <${lastPage.tagName.toLowerCase()} class="${lastPage.className}">`,
    ]);
  }

  const lastPageStyle = window.getComputedStyle(lastPage);
  if (lastPageStyle.display === 'none' || lastPageStyle.visibility === 'hidden') {
    warn([
      'Active `.taro_page` seems hidden (display/visibility).',
      `- display: ${lastPageStyle.display}`,
      `- visibility: ${lastPageStyle.visibility}`,
    ]);
  }

  for (const id of options.overlayIds) {
    if (!id) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    if (routerEl.contains(el)) {
      warn([
        `Overlay container #${id} is inside \`.taro_router\` (forbidden).`,
        'Move overlays to App root (outside `.taro_router`) or use portal to `#app`/`body`.',
      ]);
    }
  }
}

export function installH5DomGuard(options: DomGuardOptions) {
  if (!isH5Dev()) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let scheduled = false;
  const run = () => {
    scheduled = false;
    try {
      checkDom(options);
    } catch {
      // ignore
    }
  };

  const requestCheck = () => {
    if (scheduled) return;
    scheduled = true;
    schedule(run);
  };

  requestCheck();

  window.addEventListener('hashchange', requestCheck);
  window.addEventListener('popstate', requestCheck);

  const observer = new MutationObserver(requestCheck);
  const ensureObserve = () => {
    const routerEl = getRouterEl();
    if (!routerEl) {
      schedule(ensureObserve);
      return;
    }
    observer.observe(routerEl, { childList: true });
  };
  ensureObserve();

  return () => {
    window.removeEventListener('hashchange', requestCheck);
    window.removeEventListener('popstate', requestCheck);
    observer.disconnect();
  };
}


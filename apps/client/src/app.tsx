import './styles/nutui.css';
import './app.scss';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { configure as configureNutuiIcons } from '@nutui/icons-react-taro';
import { useLaunch } from '@tarojs/taro';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { AppOverlays, OVERLAY_IDS, toast } from './ui/nutui';
import { installH5DomGuard } from './lib/h5DomGuard';
import { ensureRegionNamesReady } from './lib/regions';
import { onAuthRequired } from './lib/auth';
import { goLogin, getCurrentPageUrl } from './lib/guard';
import { STATE_COPY } from './ui/copy';

if (process.env.TARO_ENV === 'weapp') {
  try {
    configureNutuiIcons({ tag: 'view' });
  } catch (err) {
    console.warn('[client] configureNutuiIcons failed', err);
  }
}

export default function App(props: { children: ReactNode }) {
  useLaunch(() => {
    console.log('[client] app launch');
    void ensureRegionNamesReady();
    if (process.env.TARO_ENV !== 'h5') return;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    if (!hash || hash === '#' || hash === '#/' || hash === '#/pages' || hash === '#/pages/') {
      window.location.hash = '#/pages/home/index';
    }

    installH5DomGuard({ overlayIds: Object.values(OVERLAY_IDS) });
  });

  useEffect(() => {
    let lastNoticeAt = 0;
    const off = onAuthRequired(() => {
      const now = Date.now();
      if (now - lastNoticeAt < 1500) return;
      lastNoticeAt = now;
      const currentUrl = getCurrentPageUrl() || '';
      if (currentUrl && currentUrl.startsWith('/subpackages/login/index')) return;
      toast(STATE_COPY.permission.needLogin.message);
      goLogin({ redirectUrl: currentUrl });
    });
    return () => off();
  }, []);

  return (
    <ErrorBoundary>
      <AppOverlays />
      {props.children}
    </ErrorBoundary>
  );
}

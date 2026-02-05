import '@nutui/nutui-react-taro/dist/style.css';
import './app.scss';

import type { ReactNode } from 'react';
import { configure as configureNutuiIcons } from '@nutui/icons-react-taro';
import { useLaunch } from '@tarojs/taro';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { AppOverlays, OVERLAY_IDS } from './ui/nutui';
import { installH5DomGuard } from './lib/h5DomGuard';
import { ensureRegionNamesReady } from './lib/regions';

if (process.env.TARO_ENV === 'weapp') {
  configureNutuiIcons({ tag: 'view' });
}

export default function App(props: { children: ReactNode }) {
  useLaunch(() => {
    void ensureRegionNamesReady();
    if (process.env.TARO_ENV !== 'h5') return;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    if (!hash || hash === '#' || hash === '#/' || hash === '#/pages' || hash === '#/pages/') {
      window.location.hash = '#/pages/home/index';
    }

    installH5DomGuard({ overlayIds: Object.values(OVERLAY_IDS) });
  });

  return (
    <ErrorBoundary>
      <AppOverlays />
      {props.children}
    </ErrorBoundary>
  );
}

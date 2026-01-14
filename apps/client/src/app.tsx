import '@nutui/nutui-react-taro/dist/style.css';
import './app.scss';

import type { ReactNode } from 'react';
import { useLaunch } from '@tarojs/taro';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { AppOverlays } from './ui/nutui';

export default function App(props: { children: ReactNode }) {
  useLaunch(() => {
    if (process.env.TARO_ENV !== 'h5') return;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    if (!hash || hash === '#' || hash === '#/' || hash === '#/pages' || hash === '#/pages/') {
      window.location.hash = '#/pages/home/index';
    }
  });

  return (
    <ErrorBoundary>
      <AppOverlays />
      {props.children}
    </ErrorBoundary>
  );
}

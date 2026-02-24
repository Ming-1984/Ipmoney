import './styles/nutui.css';
import './app.scss';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { configure as configureNutuiIcons } from '@nutui/icons-react-taro/dist/es/icons/configure';
import { useLaunch } from '@tarojs/taro';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { AppOverlays, OVERLAY_IDS, toast } from './ui/nutui';
import { installH5DomGuard } from './lib/h5DomGuard';
import { ensureRegionNamesReady } from './lib/regions';
import type { components } from '@ipmoney/api-types';
import { clearVerificationStatus, clearVerificationType, getToken, isOnboardingDone, onAuthRequired, setOnboardingDone, setToken, setVerificationStatus, setVerificationType } from './lib/auth';
import { goLogin, getCurrentPageUrl } from './lib/guard';
import { STATE_COPY } from './ui/copy';
import { apiPost } from './lib/api';
import { DEMO_AUTH_ENABLED, IS_PROD_DEPLOY } from './constants';

type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

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

    // Demo auth bootstrap for automation/smoke captures:
    // - scripts/ui-render-smoke.ps1 and scripts/capture-ui.ps1 append `?__demo_auth=1` to the H5 base URL.
    // - If demo auth is enabled, we can auto-login (once) and then reload without the flag.
    try {
      if (!DEMO_AUTH_ENABLED || IS_PROD_DEPLOY) return;
      const url = new URL(window.location.href);
      const demoFlag = String(url.searchParams.get('__demo_auth') || '').trim().toLowerCase();
      if (!demoFlag) return;

      const existingToken = getToken();
      if (existingToken) {
        url.searchParams.delete('__demo_auth');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      void (async () => {
        try {
          const auth = await apiPost<AuthTokenResponse>('/auth/wechat/mp-login', { code: 'demo' });
          const token = String(auth?.accessToken || '').trim();
          if (!token) return;

          setToken(token);
          const vt = (auth?.user?.verificationType || null) as VerificationType | null;
          const vs = (auth?.user?.verificationStatus || null) as VerificationStatus | null;
          if (vt) setVerificationType(vt);
          else clearVerificationType();
          if (vs) setVerificationStatus(vs);
          else clearVerificationStatus();
          setOnboardingDone(Boolean(vt) || isOnboardingDone());

          url.searchParams.delete('__demo_auth');
          window.history.replaceState({}, '', url.toString());
          window.location.reload();
        } catch {
          // ignore demo auth failures (keep current route untouched)
        }
      })();
    } catch {
      // ignore URL parsing errors
    }
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

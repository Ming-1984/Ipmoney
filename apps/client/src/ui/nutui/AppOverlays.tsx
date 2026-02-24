import React from 'react';

import Dialog from '@nutui/nutui-react-taro/dist/es/packages/dialog';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast';

import { ensureH5OverlayRoot } from './overlayRoot';

function maybePortal(node: React.ReactNode): React.ReactNode {
  if (process.env.TARO_ENV !== 'h5') return node;
  const root = ensureH5OverlayRoot();
  if (!root) return node;
  try {
    const { createPortal } = require('react-dom') as { createPortal: (n: React.ReactNode, c: Element) => React.ReactNode };
    return createPortal(node, root);
  } catch {
    return node;
  }
}

export const OVERLAY_IDS = {
  toast: 'app-toast',
  dialog: 'app-dialog',
} as const;

export function AppOverlays() {
  return maybePortal(
    <>
      <Toast id={OVERLAY_IDS.toast} />
      <Dialog id={OVERLAY_IDS.dialog} />
    </>,
  );
}

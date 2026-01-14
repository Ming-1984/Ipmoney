import React from 'react';

import { Dialog, Toast } from '@nutui/nutui-react-taro';

export const OVERLAY_IDS = {
  toast: 'app-toast',
  dialog: 'app-dialog',
} as const;

export function AppOverlays() {
  return (
    <>
      <Toast id={OVERLAY_IDS.toast} />
      <Dialog id={OVERLAY_IDS.dialog} />
    </>
  );
}

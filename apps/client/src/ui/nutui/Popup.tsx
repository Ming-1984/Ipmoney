import React from 'react';

import { Popup as NutPopup } from '@nutui/nutui-react-taro';

import { ensureH5OverlayRoot } from './overlayRoot';

export type PopupProps = React.ComponentProps<typeof NutPopup>;

export function Popup(props: PopupProps) {
  const lockScroll = props.lockScroll ?? true;
  const closeOnOverlayClick = props.closeOnOverlayClick ?? true;
  const portal = props.portal ?? (process.env.TARO_ENV === 'h5' ? () => ensureH5OverlayRoot() : undefined);
  return <NutPopup {...props} portal={portal} lockScroll={lockScroll} closeOnOverlayClick={closeOnOverlayClick} />;
}

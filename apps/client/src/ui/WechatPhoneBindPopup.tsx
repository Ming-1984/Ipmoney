import { View, Text, Button as TaroButton } from '@tarojs/components';
import React, { useCallback } from 'react';

import './WechatPhoneBindPopup.scss';

import { Popup } from './nutui';

export type WechatPhoneBindPopupProps = {
  visible: boolean;
  loading?: boolean;
  onRequestBind: (phoneCode: string) => void | Promise<void>;
  onSkip: () => void;
};

export function WechatPhoneBindPopup(props: WechatPhoneBindPopupProps) {
  const onGetPhoneNumber = useCallback(
    (e: any) => {
      const code = String(e?.detail?.code || '').trim();
      const errMsg = String(e?.detail?.errMsg || '').toLowerCase();

      // User denied or cancelled the phone capability; continue the flow without blocking.
      if (!code) {
        if (errMsg.includes('user deny') || errMsg.includes('fail')) {
          props.onSkip();
          return;
        }
        props.onSkip();
        return;
      }

      void props.onRequestBind(code);
    },
    [props],
  );

  return (
    <Popup
      visible={props.visible}
      position="center"
      round
      closeable={false}
      closeOnOverlayClick={false}
      lockScroll
      className="wechat-phone-popup-wrap"
    >
      <View className="wechat-phone-popup">
        <Text className="wechat-phone-title">手机号快捷登录</Text>
        <Text className="wechat-phone-subtitle">用于绑定手机号，便于咨询沟通、账号登录与交易联系。</Text>

        <View className="wechat-phone-actions">
          <TaroButton
            className="wechat-phone-btn wechat-phone-btn-primary"
            openType="getPhoneNumber"
            onGetPhoneNumber={onGetPhoneNumber}
            disabled={Boolean(props.loading)}
          >
            立即验证手机号
          </TaroButton>

          <TaroButton
            className="wechat-phone-btn wechat-phone-btn-ghost"
            onClick={props.onSkip}
            disabled={Boolean(props.loading)}
          >
            暂不验证
          </TaroButton>
        </View>
      </View>
    </Popup>
  );
}

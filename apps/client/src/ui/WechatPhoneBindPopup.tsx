import { View, Text, Button as TaroButton } from '@tarojs/components';
import React, { useCallback } from 'react';

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

      // 用户拒绝/取消：直接视为跳过，继续后续流程。
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
        <Text className="wechat-phone-title">授权手机号</Text>
        <Text className="wechat-phone-subtitle">用于咨询与交易沟通，可稍后在资料设置中绑定。</Text>

        <View className="wechat-phone-actions">
          <TaroButton
            className="wechat-phone-btn wechat-phone-btn-primary"
            openType="getPhoneNumber"
            onGetPhoneNumber={onGetPhoneNumber}
            disabled={Boolean(props.loading)}
          >
            一键授权手机号
          </TaroButton>

          <TaroButton
            className="wechat-phone-btn wechat-phone-btn-ghost"
            onClick={props.onSkip}
            disabled={Boolean(props.loading)}
          >
            暂不授权
          </TaroButton>
        </View>
      </View>
    </Popup>
  );
}

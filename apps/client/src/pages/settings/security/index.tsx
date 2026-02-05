import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback } from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Cell } from '../../../ui/nutui';

export default function SecurityPage() {
  const handleCloseAccount = useCallback(() => {
    Taro.showModal({
      title: '注销账号',
      content: '注销后无法恢复，请确认是否继续。',
      confirmText: '确认注销',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '注销申请已提交', icon: 'none' });
        }
      },
    });
  }, []);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="账号安全" subtitle="保护账号安全与隐私" />
      <Spacer />

      <TipBanner tone="info" title="安全提醒">
        建议定期检查绑定手机号与认证信息，避免账号被盗用。
      </TipBanner>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="绑定/更换手机号" extra="去设置" onClick={() => Taro.navigateTo({ url: '/pages/profile/edit/index' })} />
        <Cell title="身份认证" extra="去认证" onClick={() => Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' })} />
        <Cell title="账号注销" onClick={handleCloseAccount} />
      </Surface>

      <Spacer size={12} />
      <Surface className="settings-tip">
        <Text className="settings-tip-text">如发现异常登录或账号风险，请尽快联系平台客服处理。</Text>
      </Surface>
    </View>
  );
}

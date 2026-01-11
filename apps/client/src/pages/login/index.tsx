import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { setToken } from '../../lib/auth';

export default function LoginPage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>登录（演示）</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0：小程序登录将对接微信 code→token；此处先用演示 token。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          setToken('demo-token');
          Taro.showToast({ title: '登录成功', icon: 'success' });
          setTimeout(() => {
            Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
          }, 200);
        }}
      >
        <Text>一键登录</Text>
      </View>
    </View>
  );
}

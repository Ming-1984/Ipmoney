import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';

import { getToken, getVerificationStatus, getVerificationType } from '../../lib/auth';

export default function MePage() {
  const token = getToken();
  const verification = useMemo(() => {
    return {
      type: getVerificationType(),
      status: getVerificationStatus(),
    };
  }, []);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>我的</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">登录态：{token ? '已登录（演示 token）' : '未登录'}</Text>
        <View style={{ height: '4rpx' }} />
        <Text className="muted">
          身份：{verification.type ?? '-'} / 状态：{verification.status ?? '-'}
        </Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {!token ? (
        <View
          className="card btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/login/index' });
          }}
        >
          <Text>登录/注册</Text>
        </View>
      ) : (
        <View
          className="card btn-ghost"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
          }}
        >
          <Text>身份/认证（首次进入必选）</Text>
        </View>
      )}
    </View>
  );
}


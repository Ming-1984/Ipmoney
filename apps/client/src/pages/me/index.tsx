import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';

import { STORAGE_KEYS } from '../../constants';
import { getToken, getVerificationStatus, getVerificationType } from '../../lib/auth';

export default function MePage() {
  const token = getToken();
  const verification = useMemo(() => {
    return {
      type: getVerificationType(),
      status: getVerificationStatus(),
    };
  }, []);

  const scenario = useMemo(() => {
    return Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy';
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
        <View style={{ height: '4rpx' }} />
        <Text className="muted">Mock 场景：{scenario}</Text>
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

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>演示：切换 Mock 场景</Text>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'happy');
            Taro.showToast({ title: '已切换：happy', icon: 'success' });
          }}
        >
          <Text>happy（默认）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'empty');
            Taro.showToast({ title: '已切换：empty', icon: 'success' });
          }}
        >
          <Text>empty（空数据）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'error');
            Taro.showToast({ title: '已切换：error', icon: 'success' });
          }}
        >
          <Text>error（服务异常）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'edge');
            Taro.showToast({ title: '已切换：edge', icon: 'success' });
          }}
        >
          <Text>edge（边界数据）</Text>
        </View>
      </View>
    </View>
  );
}

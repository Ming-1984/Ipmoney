import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { getToken, getVerificationStatus, isOnboardingDone } from '../../lib/auth';

export default function PublishPage() {
  const token = getToken();
  const onboardingDone = isOnboardingDone();
  const verificationStatus = getVerificationStatus();

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发布</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">发布前需完成登录与身份选择；非个人需后台审核通过。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {!token ? (
        <View
          className="card btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/login/index' });
          }}
        >
          <Text>登录后发布</Text>
        </View>
      ) : !onboardingDone ? (
        <View
          className="card btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
          }}
        >
          <Text>首次进入：选择身份</Text>
        </View>
      ) : verificationStatus === 'PENDING' ? (
        <View className="card">
          <Text style={{ fontWeight: 700 }}>资料审核中</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">审核通过后解锁发布与交易功能（演示）。</Text>
        </View>
      ) : (
        <View>
          <View
            className="card btn-primary"
            onClick={() => {
              Taro.navigateTo({ url: '/pages/publish/patent/index' });
            }}
          >
            <Text>发布专利交易</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.navigateTo({ url: '/pages/publish/demand/index' });
            }}
          >
            <Text>发布产学研需求</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.navigateTo({ url: '/pages/publish/achievement/index' });
            }}
          >
            <Text>发布成果展示</Text>
          </View>

          <View style={{ height: '16rpx' }} />

          <View className="card">
            <Text className="muted">
              提示：可通过“我的”页切换 Mock 场景，演示审核中/无数据/异常等状态。
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

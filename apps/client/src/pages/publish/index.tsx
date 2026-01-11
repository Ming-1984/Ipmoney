import { View, Text } from '@tarojs/components';
import React from 'react';

import { ensureOnboarding } from '../../lib/guard';

export default function PublishPage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发布</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">发布前需完成登录与身份选择/审核。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          ensureOnboarding();
        }}
      >
        <Text>继续（演示：权限/审核拦截）</Text>
      </View>
    </View>
  );
}


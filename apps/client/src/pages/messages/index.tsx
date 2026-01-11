import { View, Text } from '@tarojs/components';
import React from 'react';

import { requireLogin } from '../../lib/guard';

export default function MessagesPage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>咨询/消息</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0 先做工单式消息（非实时），后续可演进 WebSocket。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          if (!requireLogin()) return;
        }}
      >
        <Text>进入会话列表（演示）</Text>
      </View>
    </View>
  );
}


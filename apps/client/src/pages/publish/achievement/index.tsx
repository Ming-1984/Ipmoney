import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState } from 'react';

import { ensureOnboarding } from '../../../lib/guard';

export default function PublishAchievementPage() {
  const [title, setTitle] = useState('');

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发布：成果展示</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0：先演示发布入口；后续可扩展项目介绍、图片、视频等。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>成果标题</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          placeholder="例如：某高校储能材料成果转化"
        />
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          if (!ensureOnboarding()) return;
          if (!title.trim()) {
            Taro.showToast({ title: '请填写标题', icon: 'none' });
            return;
          }
          Taro.showToast({ title: '已提交审核（演示）', icon: 'success' });
          setTimeout(() => Taro.switchTab({ url: '/pages/me/index' }), 200);
        }}
      >
        <Text>提交发布（演示）</Text>
      </View>
    </View>
  );
}

import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState } from 'react';

import { ensureOnboarding } from '../../../lib/guard';

export default function PublishDemandPage() {
  const [title, setTitle] = useState('');

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发布：产学研需求</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0：先演示表单/审核链路；后续再补齐字段与附件上传。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>需求标题</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          placeholder="例如：寻求电池热管理相关专利许可"
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

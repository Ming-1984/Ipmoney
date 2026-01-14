import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState } from 'react';

import { ensureApproved } from '../../../lib/guard';
import { PageHeader, Spacer } from '../../../ui/layout';
import { Button, Input } from '../../../ui/nutui';

export default function PublishDemandPage() {
  const [title, setTitle] = useState('');

  return (
    <View className="container">
      <PageHeader
        variant="hero"
        title="发布：产学研需求"
        subtitle="填写需求信息并提交审核；审核通过后对外展示。"
      />
      <Spacer />

      <View className="card">
        <Text className="text-card-title">需求标题</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={title}
          onChange={setTitle}
          placeholder="例如：寻求电池热管理相关专利许可"
          clearable
        />
      </View>

      <Spacer />

      <View className="card">
        <Button
          onClick={() => {
            if (!ensureApproved()) return;
            if (!title.trim()) {
              Taro.showToast({ title: '请填写标题', icon: 'none' });
              return;
            }
            Taro.showToast({ title: '已提交审核', icon: 'success' });
            setTimeout(() => Taro.switchTab({ url: '/pages/me/index' }), 200);
          }}
        >
          提交发布
        </Button>
      </View>
    </View>
  );
}

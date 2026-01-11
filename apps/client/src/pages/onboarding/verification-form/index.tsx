import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';

import { setOnboardingDone, setVerificationStatus } from '../../../lib/auth';
import { getVerificationType } from '../../../lib/auth';
import { requireLogin } from '../../../lib/guard';

export default function VerificationFormPage() {
  const type = useMemo(() => getVerificationType(), []);
  const [name, setName] = useState('');

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>资料提交（演示）</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">当前身份：{type ?? '-'}</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 600 }}>机构/主体名称</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={name}
          onInput={(e) => setName(e.detail.value)}
          placeholder="请输入名称（演示）"
        />
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          if (!requireLogin()) return;
          if (!name.trim()) {
            Taro.showToast({ title: '请填写名称', icon: 'none' });
            return;
          }
          setVerificationStatus('PENDING');
          setOnboardingDone(true);
          Taro.showToast({ title: '已提交，等待审核', icon: 'none' });
          setTimeout(() => {
            Taro.switchTab({ url: '/pages/me/index' });
          }, 200);
        }}
      >
        <Text>提交并进入审核中</Text>
      </View>
    </View>
  );
}


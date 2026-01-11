import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import { setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { requireLogin } from '../../../lib/guard';
import type { VerificationType } from '../../../constants';

const TYPES: Array<{ type: VerificationType; title: string; desc: string }> = [
  { type: 'PERSON', title: '个人', desc: '授权信息后直接注册成功' },
  { type: 'COMPANY', title: '企业', desc: '提交资料 → 后台审核通过后入驻展示' },
  { type: 'ACADEMY', title: '科研院校', desc: '提交资料 → 后台审核通过后入驻展示' },
  { type: 'GOVERNMENT', title: '政府', desc: '提交资料 → 后台审核' },
  { type: 'ASSOCIATION', title: '行业协会/学会', desc: '提交资料 → 后台审核' },
  { type: 'TECH_MANAGER', title: '技术经理人', desc: '提交资质 → 后台审核' },
];

export default function ChooseIdentityPage() {
  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>首次进入：选择身份</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">个人可直接完成；其余需提交资料并后台审核。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {TYPES.map((t) => (
        <View
          key={t.type}
          className="card"
          style={{ marginBottom: '16rpx' }}
          onClick={() => {
            if (!requireLogin()) return;
            setVerificationType(t.type);
            if (t.type === 'PERSON') {
              setVerificationStatus('APPROVED');
              setOnboardingDone(true);
              Taro.showToast({ title: '注册成功', icon: 'success' });
              setTimeout(() => {
                Taro.switchTab({ url: '/pages/home/index' });
              }, 200);
              return;
            }
            Taro.navigateTo({ url: '/pages/onboarding/verification-form/index' });
          }}
        >
          <Text style={{ fontWeight: 700 }}>{t.title}</Text>
          <View style={{ height: '6rpx' }} />
          <Text className="muted">{t.desc}</Text>
        </View>
      ))}
    </View>
  );
}


import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import type { VerificationType } from '../../../constants';
import { PageHeader, Spacer } from '../../../ui/layout';

const TYPES: Array<{ type: VerificationType; title: string; desc: string; icon: string; tag: string; bg: string }> = [
  {
    type: 'PERSON',
    title: '个人',
    desc: '授权信息后直接完成注册',
    icon: '人',
    tag: '秒通过',
    bg: 'linear-gradient(135deg, #FF6A00, #FFC54D)',
  },
  {
    type: 'COMPANY',
    title: '企业',
    desc: '提交资料 → 审核通过后入驻展示',
    icon: '企',
    tag: '需审核',
    bg: 'linear-gradient(135deg, #2563EB, #22D3EE)',
  },
  {
    type: 'ACADEMY',
    title: '科研院校',
    desc: '提交资料 → 审核通过后入驻展示',
    icon: '校',
    tag: '需审核',
    bg: 'linear-gradient(135deg, #16A34A, #34D399)',
  },
  {
    type: 'GOVERNMENT',
    title: '政府',
    desc: '提交资料 → 后台审核',
    icon: '政',
    tag: '需审核',
    bg: 'linear-gradient(135deg, #0EA5E9, #A78BFA)',
  },
  {
    type: 'ASSOCIATION',
    title: '行业协会/学会',
    desc: '提交资料 → 后台审核',
    icon: '协',
    tag: '需审核',
    bg: 'linear-gradient(135deg, #7C3AED, #FB7185)',
  },
  {
    type: 'TECH_MANAGER',
    title: '技术经理人',
    desc: '提交资质 → 后台审核',
    icon: '技',
    tag: '需审核',
    bg: 'linear-gradient(135deg, #111827, #64748B)',
  },
];

export default function ChooseIdentityPage() {
  return (
    <View className="container">
      <PageHeader title="首次进入：选择身份" subtitle="个人可直接完成注册；机构/技术经理人需提交资料并等待审核。" />
      <Spacer />

      <View className="card home-grid" style={{ padding: 0, overflow: 'hidden' }}>
        {TYPES.map((t, idx) => (
          <View
            key={t.type}
            className={`home-grid-item ${idx % 2 === 0 ? 'home-grid-item-br' : ''} ${idx < 4 ? 'home-grid-item-bb' : ''}`}
            onClick={() => {
              if (!requireLogin()) return;
              setVerificationType(t.type);
              if (t.type === 'PERSON') {
                (async () => {
                  try {
                    const res = await apiPost<components['schemas']['UserVerification']>('/me/verification', {
                      type: 'PERSON',
                      displayName: '个人用户',
                    });
                    setVerificationStatus(res.status);
                    setOnboardingDone(true);
                    Taro.showToast({ title: '注册成功', icon: 'success' });
                    setTimeout(() => {
                      const pages = Taro.getCurrentPages();
                      if (pages.length > 1) {
                        Taro.navigateBack();
                        return;
                      }
                      Taro.switchTab({ url: '/pages/home/index' });
                    }, 200);
                  } catch (e: any) {
                    Taro.showToast({ title: e?.message || '提交失败', icon: 'none' });
                  }
                })();
                return;
              }
              Taro.navigateTo({ url: '/pages/onboarding/verification-form/index' });
            }}
          >
            <View className="home-grid-icon" style={{ background: t.bg }}>
              <Text className="text-strong" style={{ color: '#fff' }}>
                {t.icon}
              </Text>
            </View>
            <View style={{ height: '10rpx' }} />
            <View className="row-between" style={{ gap: '12rpx' }}>
              <Text className="text-card-title clamp-1 flex-1">{t.title}</Text>
              <Text className={`tag ${t.type === 'PERSON' ? 'tag-gold' : ''}`}>{t.tag}</Text>
            </View>
            <View style={{ height: '6rpx' }} />
            <Text className="text-caption break-word clamp-2">{t.desc}</Text>
          </View>
        ))}
      </View>

      <Spacer />

      <View className="card">
        <Text className="text-card-title">提示</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">
          企业/科研院校审核通过后，会在「机构展示」中对外展示。可在「我的 → 身份/认证」查看审核进度。
        </Text>
      </View>
    </View>
  );
}

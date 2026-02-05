import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import type { VerificationType } from '../../../constants';
import { Spacer, TipBanner } from '../../../ui/layout';
import { toast } from '../../../ui/nutui';

const TYPES: Array<{
  type: VerificationType;
  title: string;
  desc: string;
  icon: string;
  tag: string;
  badge: React.ComponentProps<typeof IconBadge>['variant'];
  tagTone?: 'gold';
}> = [
  {
    type: 'PERSON',
    title: '个人',
    desc: '授权信息后直接完成注册',
    icon: '人',
    tag: '秒通过',
    badge: 'brand',
    tagTone: 'gold',
  },
  {
    type: 'COMPANY',
    title: '企业',
    desc: '提交资料 → 审核通过后入驻展示',
    icon: '企',
    tag: '需审核',
    badge: 'blue',
  },
  {
    type: 'ACADEMY',
    title: '科研院校',
    desc: '提交资料 → 审核通过后入驻展示',
    icon: '校',
    tag: '需审核',
    badge: 'green',
  },
  {
    type: 'GOVERNMENT',
    title: '政府',
    desc: '提交资料 → 后台审核',
    icon: '政',
    tag: '需审核',
    badge: 'purple',
  },
  {
    type: 'ASSOCIATION',
    title: '行业协会/学会',
    desc: '提交资料 → 后台审核',
    icon: '协',
    tag: '需审核',
    badge: 'purple',
  },
  {
    type: 'TECH_MANAGER',
    title: '技术经理人',
    desc: '提交资质 → 后台审核',
    icon: '技',
    tag: '需审核',
    badge: 'slate',
  },
];

export default function ChooseIdentityPage() {
  useEffect(() => {
    try {
      Taro.setNavigationBarTitle({ title: '选择身份' });
    } catch {
      // ignore
    }
  }, []);

  return (
    <View className="container identity-page">
      <View className="identity-header">
        <Text className="identity-title">选择你的身份</Text>
        <Text className="identity-subtitle">个人可直接完成注册；机构/技术经理人需提交资料并等待审核。</Text>
      </View>

      <View className="identity-grid">
        {TYPES.map((t) => (
          <View
            key={t.type}
            className="identity-card"
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
                    toast('注册成功', { icon: 'success' });
                    setTimeout(() => {
                      const pages = Taro.getCurrentPages();
                      if (pages.length > 1) {
                        Taro.navigateBack();
                        return;
                      }
                      Taro.switchTab({ url: '/pages/home/index' });
                    }, 200);
                  } catch (e: any) {
                    toast(e?.message || '提交失败');
                  }
                })();
                return;
              }
              Taro.navigateTo({ url: '/pages/onboarding/verification-form/index' });
            }}
          >
            <View className={`identity-icon identity-icon-${t.badge}`}>
              <Text className="identity-icon-text">{t.icon}</Text>
            </View>
            <View className="identity-card-title-row">
              <Text className="identity-card-title">{t.title}</Text>
              <Text className={`identity-card-badge ${t.tagTone === 'gold' ? 'is-gold' : ''}`}>{t.tag}</Text>
            </View>
            <Text className="identity-card-desc">{t.desc}</Text>
          </View>
        ))}
      </View>

      <Spacer size={12} />

      <TipBanner tone="info" title="提示" className="identity-tip">
        企业/科研院校审核通过后，会在「机构展示」中对外展示。可在「我的 → 身份/认证」查看审核进度。
      </TipBanner>
    </View>
  );
}

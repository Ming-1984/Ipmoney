import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef } from 'react';
import './index.scss';

import type { VerificationType } from '../../../constants';

import { setVerificationType } from '../../../lib/auth';
import { requireLogin } from '../../../lib/guard';
import { safeOpenPage } from '../../../lib/navigation';
import { toast } from '../../../ui/nutui';

type BadgeVariant = 'gold' | 'blue' | 'green' | 'purple' | 'orange' | 'sky';

type IdentityOption = {
  type: VerificationType;
  title: string;
  icon: string;
  badge: BadgeVariant;
  steps: string[];
};

const TYPES: IdentityOption[] = [
  {
    type: 'PERSON',
    title: '个人',
    icon: '人',
    badge: 'gold',
    steps: ['授权信息', '直接完成注册'],
  },
  {
    type: 'COMPANY',
    title: '企业',
    icon: '企',
    badge: 'blue',
    steps: ['提交资料', '审核通过', '入驻展示'],
  },
  {
    type: 'ACADEMY',
    title: '科研院校',
    icon: '校',
    badge: 'green',
    steps: ['提交资料', '审核通过', '入驻展示'],
  },
  {
    type: 'GOVERNMENT',
    title: '政府',
    icon: '政',
    badge: 'purple',
    steps: ['提交资料', '平台审核'],
  },
  {
    type: 'ASSOCIATION',
    title: '行业协会/学会',
    icon: '协',
    badge: 'orange',
    steps: ['提交资料', '平台审核'],
  },
  {
    type: 'TECH_MANAGER',
    title: '技术经理人',
    icon: '技',
    badge: 'sky',
    steps: ['提交资料', '平台审核'],
  },
];

const WEAPP_DEBUG = process.env.NODE_ENV !== 'production' && process.env.TARO_ENV === 'weapp';

function reportWeappDebug(title: string, detail?: unknown) {
  if (!WEAPP_DEBUG) return;
  console.error(`[weapp-debug] ${title}`, detail);
}

export default function ChooseIdentityPage() {
  const navigatingRef = useRef(false);

  useEffect(() => {
    try {
      Taro.setNavigationBarTitle({ title: '选择身份' });
    } catch {
      // ignore
    }
  }, []);

  const openIdentity = useCallback(async (option: IdentityOption) => {
    if (navigatingRef.current) return;
    if (!requireLogin()) return;

    navigatingRef.current = true;
    reportWeappDebug('identity option clicked', { type: option.type });

    try {
      setVerificationType(option.type);
      if (option.type === 'PERSON') {
        await safeOpenPage(
          `/subpackages/profile/edit/index?from=login&verifyType=PERSON&nextType=switchTab&nextUrl=${encodeURIComponent(
            '/pages/me/index',
          )}`,
        );
        return;
      }

      await safeOpenPage('/subpackages/onboarding/verification-form/index');
    } catch (error) {
      reportWeappDebug('identity navigation failed', { type: option.type, error });
      toast('打开认证表单失败，请稍后重试');
    } finally {
      setTimeout(() => {
        navigatingRef.current = false;
      }, 250);
    }
  }, []);

  return (
    <View className="container identity-page">
      <View className="identity-header">
        <Text className="identity-title">选择你的身份</Text>
        <Text className="identity-subtitle">个人可直接完成注册；机构/技术经理人需提交资料并等待审核。</Text>
      </View>

      <View className="identity-grid">
        {TYPES.map((item) => (
          <View
            key={item.type}
            className={`identity-card identity-card-${item.badge}`}
            onClick={() => {
              void openIdentity(item);
            }}
          >
            <View className="identity-card-head">
              <View className={`identity-icon identity-icon-${item.badge}`}>
                <Text className="identity-icon-text">{item.icon}</Text>
              </View>
              <Text className="identity-card-title">{item.title}</Text>
            </View>

            <View className="identity-divider" />

            <View className="identity-steps">
              {item.steps.map((step, index) => (
                <View key={step} className="identity-step">
                  <View className={`identity-step-dot ${index > 0 ? 'is-muted' : ''}`} />
                  <Text className="identity-step-text">{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View className="identity-tip">
        <Text className="identity-tip-title">提示</Text>
        <Text className="identity-tip-text">
          企业/科研院校审核通过后，会在「机构展示」中对外展示，可在「我的 &gt; 身份/认证」查看审核进度。
        </Text>
      </View>
    </View>
  );
}

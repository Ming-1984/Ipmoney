import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef } from 'react';
import './index.scss';

import type { VerificationType } from '../../../constants';

import { setVerificationType } from '../../../lib/auth';
import { requireLogin } from '../../../lib/guard';
import { safeOpenPage } from '../../../lib/navigation';
import { Spacer, TipBanner } from '../../../ui/layout';
import { Button, toast } from '../../../ui/nutui';

type BadgeVariant = 'brand' | 'blue' | 'green' | 'purple' | 'slate';

type IdentityOption = {
  type: VerificationType;
  title: string;
  desc: string;
  icon: string;
  tag: string;
  badge: BadgeVariant;
  tagTone?: 'gold';
};

const TYPES: IdentityOption[] = [
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
    desc: '提交资料，审核通过后入驻展示',
    icon: '企',
    tag: '需审核',
    badge: 'blue',
  },
  {
    type: 'ACADEMY',
    title: '科研院校',
    desc: '提交资料，审核通过后入驻展示',
    icon: '校',
    tag: '需审核',
    badge: 'green',
  },
  {
    type: 'GOVERNMENT',
    title: '政府',
    desc: '提交资料，后台审核',
    icon: '政',
    tag: '需审核',
    badge: 'purple',
  },
  {
    type: 'ASSOCIATION',
    title: '行业协会/学会',
    desc: '提交资料，后台审核',
    icon: '协',
    tag: '需审核',
    badge: 'purple',
  },
  {
    type: 'TECH_MANAGER',
    title: '技术经理人',
    desc: '提交资质，后台审核',
    icon: '技',
    tag: '需审核',
    badge: 'slate',
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
          <Button
            key={item.type}
            className="identity-card"
            variant="default"
            fill="none"
            block={false}
            onClick={() => {
              void openIdentity(item);
            }}
          >
            <View className={`identity-icon identity-icon-${item.badge}`}>
              <Text className="identity-icon-text">{item.icon}</Text>
            </View>
            <View className="identity-card-title-row">
              <Text className="identity-card-title">{item.title}</Text>
              <Text className={`identity-card-badge ${item.tagTone === 'gold' ? 'is-gold' : ''}`}>{item.tag}</Text>
            </View>
            <Text className="identity-card-desc">{item.desc}</Text>
          </Button>
        ))}
      </View>

      <Spacer size={12} />

      <TipBanner tone="info" title="提示" className="identity-tip">
        企业/科研院校审核通过后，会在「机构展示」中对外展示。可在「我的 → 身份/认证」查看审核进度。
      </TipBanner>
    </View>
  );
}

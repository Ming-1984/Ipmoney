import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';

import type { components } from '@ipmoney/api-types';

import { setOnboardingDone, setVerificationStatus, setVerificationType } from '../../../lib/auth';
import { apiPost } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import type { VerificationType } from '../../../constants';
import { CellRow, IconBadge, PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { CellGroup, toast } from '../../../ui/nutui';

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
  return (
    <View className="container">
      <PageHeader title="首次进入：选择身份" subtitle="个人可直接完成注册；机构/技术经理人需提交资料并等待审核。" />
      <Spacer />

      <Surface padding="none">
        <CellGroup divider>
          {TYPES.map((t, idx) => (
            <CellRow
              key={t.type}
              title={
                <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
                  <IconBadge variant={t.badge} size="md">
                    <Text className="text-strong" style={{ color: '#fff' }}>
                      {t.icon}
                    </Text>
                  </IconBadge>

                  <View className="min-w-0" style={{ flex: 1 }}>
                    <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
                      <Text className="text-strong clamp-1">{t.title}</Text>
                      <Text className={`tag ${t.tagTone === 'gold' ? 'tag-gold' : ''}`}>{t.tag}</Text>
                    </View>
                    <View style={{ height: '4rpx' }} />
                    <Text className="text-caption break-word">{t.desc}</Text>
                  </View>
                </View>
              }
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
              isLast={idx === TYPES.length - 1}
            />
          ))}
        </CellGroup>
      </Surface>

      <Spacer size={12} />

      <TipBanner tone="info" title="提示">
        企业/科研院校审核通过后，会在「机构展示」中对外展示。可在「我的 → 身份/认证」查看审核进度。
      </TipBanner>
    </View>
  );
}

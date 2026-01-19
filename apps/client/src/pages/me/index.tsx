import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { APP_MODE, ENABLE_MOCK_TOOLS, STORAGE_KEYS } from '../../constants';
import {
  clearToken,
  clearVerificationStatus,
  clearVerificationType,
  getToken,
  getVerificationStatus,
  getVerificationType,
  isOnboardingDone,
  setOnboardingDone,
  setVerificationStatus,
  setVerificationType,
} from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';
import { Surface } from '../../ui/layout';
import { AppIcon } from '../../ui/Icon';
import { Avatar, Button, Tag, toast } from '../../ui/nutui';

type Me = {
  id: string;
  phone?: string;
  nickname?: string;
  avatarUrl?: string;
  role?: string;
  verificationStatus?: string;
  verificationType?: string;
  regionCode?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UserVerification = components['schemas']['UserVerification'];

function verificationTypeLabel(t?: string | null): string {
  if (!t) return '-';
  if (t === 'PERSON') return '个人';
  if (t === 'COMPANY') return '企业';
  if (t === 'ACADEMY') return '科研院校';
  if (t === 'GOVERNMENT') return '政府';
  if (t === 'ASSOCIATION') return '行业协会/学会';
  if (t === 'TECH_MANAGER') return '技术经理人';
  return t;
}

function verificationStatusLabel(s?: string | null): string {
  if (!s) return '-';
  if (s === 'PENDING') return '审核中';
  if (s === 'APPROVED') return '已通过';
  if (s === 'REJECTED') return '已驳回';
  return s;
}

function verificationStatusTagType(s?: string | null): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger' {
  if (s === 'APPROVED') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'PENDING') return 'warning';
  return 'default';
}

export default function MePage() {
  const [auth, setAuth] = useState(() => ({
    token: getToken(),
    onboardingDone: isOnboardingDone(),
    verificationType: getVerificationType(),
    verificationStatus: getVerificationStatus(),
  }));

  useDidShow(() => {
    setAuth({
      token: getToken(),
      onboardingDone: isOnboardingDone(),
      verificationType: getVerificationType(),
      verificationStatus: getVerificationStatus(),
    });
  });

  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [scenario, setScenario] = useState(() => Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy');

  const loadMe = useCallback(async () => {
    if (!auth.token) return;
    setMeLoading(true);
    setMeError(null);
    try {
      const d = await apiGet<Me>('/me');
      setMe(d);
    } catch (e: any) {
      setMeError(e?.message || '加载失败');
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, [auth.token]);

  const syncVerification = useCallback(async () => {
    if (!auth.token) return;
    try {
      const v = await apiGet<UserVerification>('/me/verification');
      if (v?.type) setVerificationType(v.type);
      if (v?.status) setVerificationStatus(v.status);
      setOnboardingDone(true);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('404')) {
        clearVerificationType();
        clearVerificationStatus();
        setOnboardingDone(false);
      }
    } finally {
      setAuth({
        token: getToken(),
        onboardingDone: isOnboardingDone(),
        verificationType: getVerificationType(),
        verificationStatus: getVerificationStatus(),
      });
    }
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) {
      setMe(null);
      return;
    }
    void loadMe();
  }, [auth.token, loadMe]);

  useEffect(() => {
    if (!auth.token) return;
    void syncVerification();
  }, [auth.token, syncVerification]);

  const verification = useMemo(() => {
    return { type: auth.verificationType, status: auth.verificationStatus };
  }, [auth.verificationStatus, auth.verificationType]);

  const serviceItems = useMemo(
    () => [
      {
        key: 'orders',
        title: '我的订单',
        desc: '订金/尾款/退款进度',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/orders/index' });
        },
      },
      {
        key: 'favorites',
        title: '我的收藏',
        desc: '专利/需求/成果/书画',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/favorites/index' });
        },
      },
      {
        key: 'listings',
        title: '我的专利上架',
        desc: '管理草稿/上架/下架',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-listings/index' });
        },
      },
      {
        key: 'demands',
        title: '我的需求',
        desc: '发布与管理需求',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-demands/index' });
        },
      },
      {
        key: 'achievements',
        title: '我的成果',
        desc: '发布与管理成果',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-achievements/index' });
        },
      },
      {
        key: 'artworks',
        title: '我的书画',
        desc: '发布与管理作品',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-artworks/index' });
        },
      },
    ],
    [],
  );

  const extraItems = useMemo(
    () => [
      {
        key: 'identity',
        title: '身份/认证',
        desc: '企业/院校/个人认证',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
        },
      },
      {
        key: 'messages',
        title: '咨询/消息',
        desc: '查看会话与跟单',
        onClick: () => {
          Taro.switchTab({ url: '/pages/messages/index' });
        },
      },
      {
        key: 'organizations',
        title: '机构展示',
        desc: '企业/科研院校入驻展示',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/organizations/index' });
        },
      },
      {
        key: 'rules',
        title: '交易规则',
        desc: '订金/佣金/退款窗口等',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/trade-rules/index' });
        },
      },
      {
        key: 'profile',
        title: '资料设置',
        desc: '昵称/地区等',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/profile/edit/index' });
        },
      },
    ],
    [],
  );

  return (
    <View className="container me-v4">
      <View className="me-header">
        <View>
          <Text className="me-eyebrow">PROFILE</Text>
          <Text className="text-hero">我的</Text>
        </View>
      </View>

      {!auth.token ? (
        <Surface className="me-hero-card me-auth-card">
          <Text className="me-hero-title">未登录</Text>
          <Text className="me-hero-subtitle">登录并审核通过后，可进行收藏/咨询/下单/支付。</Text>
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            微信授权登录
          </Button>
        </Surface>
      ) : (
        <>
          {meLoading ? <LoadingCard text="加载我的资料…" /> : null}
          {meError ? <ErrorCard message={meError} onRetry={loadMe} /> : null}
          {me && !meLoading && !meError ? (
            <Surface className="me-hero-card">
              <View className="me-hero">
                <View className="me-avatar">
                  <Avatar
                    size="88"
                    src={me.avatarUrl || ''}
                    icon={<Text className="text-strong">{(me.nickname || '用').slice(0, 1)}</Text>}
                  />
                </View>
                <View className="me-hero-meta">
                  <View className="me-hero-title-row">
                    <Text className="me-hero-title">{me.nickname || '未设置昵称'}</Text>
                    <View className="me-hero-badges">
                      {verification.type ? (
                        <View className="me-badge me-badge-outline">
                          <Text>{verificationTypeLabel(verification.type)}</Text>
                        </View>
                      ) : null}
                      {verification.status ? (
                        <View className={`me-badge me-badge-${verification.status?.toLowerCase() || 'default'}`}>
                          <Text>{verificationStatusLabel(verification.status)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text className="me-hero-subtitle">{me.phone || '未绑定手机号'}</Text>
                  <Text className="me-hero-subtitle">地区：{me.regionCode || '未设置'}</Text>
                </View>
              </View>

              <View className="me-hero-actions">
                <Button
                  size="small"
                  block
                  onClick={() => {
                    Taro.navigateTo({ url: '/pages/profile/edit/index' });
                  }}
                >
                  {!me.avatarUrl || !me.nickname ? '完善资料' : '资料设置'}
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  block
                  onClick={() => {
                    void syncVerification();
                  }}
                >
                  刷新认证
                </Button>
              </View>
            </Surface>
          ) : null}

          <Surface className="me-grid-card" padding="md">
            <Text className="me-grid-title">服务功能</Text>
            <View className="me-feature-grid">
              {serviceItems.map((item) => (
                <View key={item.key} className="me-feature" onClick={item.onClick}>
                  <View className="me-feature-icon">
                    <AppIcon name="patent-achievement" size={36} />
                  </View>
                  <Text className="me-feature-title">{item.title}</Text>
                  <Text className="me-feature-desc">{item.desc}</Text>
                </View>
              ))}
            </View>
          </Surface>

          <Surface className="me-grid-card" padding="md">
            <Text className="me-grid-title">更多功能</Text>
            <View className="me-feature-grid">
              {extraItems.map((item) => (
                <View key={item.key} className="me-feature" onClick={item.onClick}>
                  <View className="me-feature-icon">
                    <AppIcon name="patent-map" size={36} />
                  </View>
                  <Text className="me-feature-title">{item.title}</Text>
                  <Text className="me-feature-desc">{item.desc}</Text>
                </View>
              ))}
            </View>
          </Surface>

          <Surface className="me-logout-card" padding="md">
            <Button
              variant="ghost"
              onClick={() => {
                clearToken();
                toast('已退出登录', { icon: 'success' });
                setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 200);
              }}
            >
              退出登录
            </Button>
          </Surface>
        </>
      )}

      {ENABLE_MOCK_TOOLS && APP_MODE === 'development' ? (
        <Surface className="me-devtools-card">
          <Text className="text-card-title">开发工具：场景</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">当前：{scenario}</Text>
          <View style={{ height: '12rpx' }} />
          <View className="chip-row">
            {[
              ['happy', 'happy'],
              ['empty', 'empty'],
              ['error', 'error'],
              ['edge', 'edge'],
              ['payment_callback_replay', 'pay-replay'],
              ['refund_failed', 'refund-failed'],
              ['order_conflict', 'order-conflict'],
            ].map(([value, label]) => (
              <View key={value} style={{ marginRight: '12rpx', marginBottom: '12rpx' }}>
                <View
                  className={`chip ${scenario === value ? 'chip-active' : ''}`}
                  onClick={() => {
                    Taro.setStorageSync(STORAGE_KEYS.mockScenario, value);
                    setScenario(value);
                    toast(`已切换：${value}`, { icon: 'success' });
                  }}
                >
                  <Text>{label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Surface>
      ) : null}
    </View>
  );
}



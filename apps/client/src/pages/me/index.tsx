import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

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
import { regionDisplayName } from '../../lib/regions';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';
import { Surface } from '../../ui/layout';
import { Avatar, Button, PullToRefresh, toast } from '../../ui/nutui';

import iconShield from '../../assets/icons/icon-shield-orange.svg';
import iconAward from '../../assets/icons/icon-award-teal.svg';
import iconPalette from '../../assets/icons/icon-palette-orange.svg';
import iconTrending from '../../assets/icons/icon-trending-red.svg';
import iconActivity from '../../assets/icons/icon-activity-blue.svg';
import iconMap from '../../assets/icons/icon-map-green.svg';
import iconCategory from '../../assets/icons/icon-category-gray.svg';
import iconMore from '../../assets/icons/icon-more-gray.svg';
import iconUser from '../../assets/icons/icon-user-purple.svg';
import iconBriefcase from '../../assets/icons/icon-briefcase-indigo.svg';

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

type IconItem = { key: string; label: string; icon: string; onClick: () => void };

type ToolItem = { key: string; label: string; icon: string; value?: string; onClick: () => void };

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
  const [orderTab, setOrderTab] = useState<'buyer' | 'seller'>('buyer');
  const [refreshing, setRefreshing] = useState(false);

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

  const refresh = useCallback(async () => {
    if (!auth.token) return;
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadMe(), syncVerification()]);
    } finally {
      setRefreshing(false);
    }
  }, [auth.token, loadMe, refreshing, syncVerification]);

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

  const buildOrderUrl = useCallback((role: 'BUYER' | 'SELLER', status?: string) => {
    const base = `/pages/orders/index?role=${role}`;
    return status ? `${base}&status=${status}` : base;
  }, []);

  const buyerOrders = useMemo<IconItem[]>(
    () => [
      { key: 'deposit', label: '待付订金', icon: iconAward, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'DEPOSIT_PENDING') }) },
      { key: 'contract', label: '待签合同', icon: iconCategory, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'DEPOSIT_PAID') }) },
      { key: 'final', label: '待付尾款', icon: iconActivity, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'WAIT_FINAL_PAYMENT') }) },
      { key: 'change', label: '变更中', icon: iconTrending, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'FINAL_PAID_ESCROW') }) },
      { key: 'done', label: '已完成', icon: iconShield, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'COMPLETED') }) },
      { key: 'refund', label: '退款/售后', icon: iconMore, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'REFUNDING') }) },
      { key: 'cancel', label: '已取消', icon: iconUser, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER', 'CANCELLED') }) },
    ],
    [buildOrderUrl],
  );

  const sellerOrders = useMemo<IconItem[]>(
    () => [
      { key: 'material', label: '补材料', icon: iconBriefcase, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER', 'DEPOSIT_PAID') }) },
      { key: 'contract', label: '待签合同', icon: iconCategory, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER', 'DEPOSIT_PAID') }) },
      { key: 'final', label: '待收尾款', icon: iconActivity, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER', 'WAIT_FINAL_PAYMENT') }) },
      { key: 'change', label: '变更中', icon: iconTrending, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER', 'FINAL_PAID_ESCROW') }) },
      { key: 'done', label: '已完成', icon: iconShield, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER', 'COMPLETED') }) },
    ],
    [buildOrderUrl],
  );

  const publishItems = useMemo<IconItem[]>(
    () => [
      { key: 'listings', label: '我的专利', icon: iconAward, onClick: () => Taro.navigateTo({ url: '/pages/my-listings/index' }) },
      { key: 'artworks', label: '我的书画', icon: iconPalette, onClick: () => Taro.navigateTo({ url: '/pages/my-artworks/index' }) },
      { key: 'demands', label: '技术需求', icon: iconTrending, onClick: () => Taro.navigateTo({ url: '/pages/my-demands/index' }) },
      { key: 'achievements', label: '成果案例', icon: iconActivity, onClick: () => Taro.navigateTo({ url: '/pages/my-achievements/index' }) },
    ],
    [],
  );

  const favoriteItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'favorites',
        label: '我的收藏',
        icon: iconAward,
        onClick: () => Taro.navigateTo({ url: '/pages/favorites/index' }),
      },
    ],
    [],
  );

  const serviceItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'support',
        label: '客服中心',
        icon: iconShield,
        onClick: () => Taro.navigateTo({ url: '/pages/support/index' }),
      },
      {
        key: 'notice',
        label: '通知',
        icon: iconTrending,
        onClick: () => Taro.navigateTo({ url: '/pages/notifications/index' }),
      },
      {
        key: 'notify',
        label: '通知设置',
        icon: iconActivity,
        onClick: () => Taro.navigateTo({ url: '/pages/settings/notifications/index' }),
      },
      {
        key: 'invoice',
        label: '发票管理中心',
        icon: iconCategory,
        onClick: () => Taro.navigateTo({ url: '/pages/invoices/index' }),
      },
      {
        key: 'contract-center',
        label: '合同中心',
        icon: iconBriefcase,
        onClick: () => Taro.navigateTo({ url: '/pages/contracts/index' }),
      },
      {
        key: 'address',
        label: '地址管理',
        icon: iconMap,
        onClick: () => Taro.navigateTo({ url: '/pages/addresses/index' }),
      },
    ],
    [],
  );

  const accountItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'identity',
        label: '身份/认证',
        value: verificationStatusLabel(verification.status),
        icon: iconShield,
        onClick: () => Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' }),
      },
      {
        key: 'profile',
        label: '资料设置',
        icon: iconUser,
        onClick: () => Taro.navigateTo({ url: '/pages/profile/edit/index' }),
      },
      {
        key: 'security',
        label: '账号安全',
        icon: iconBriefcase,
        onClick: () => Taro.navigateTo({ url: '/pages/settings/security/index' }),
      },
      {
        key: 'about',
        label: '关于与合规',
        icon: iconMore,
        onClick: () => Taro.navigateTo({ url: '/pages/about/index' }),
      },
      {
        key: 'help',
        label: '帮助与反馈',
        icon: iconMap,
        onClick: () => Taro.navigateTo({ url: '/pages/support/index' }),
      },
      {
        key: 'rules',
        label: '交易规则',
        icon: iconCategory,
        onClick: () => Taro.navigateTo({ url: '/pages/trade-rules/index' }),
      },
    ],
    [verification.status],
  );

  const displayName = me?.nickname || '未设置昵称';
  const displayPhone = me?.phone || '未绑定手机号';
  const rawRegion = regionDisplayName(me?.regionCode);
  const displayRegion = rawRegion && rawRegion !== me?.regionCode && !/^\d+$/.test(rawRegion) ? rawRegion : '';
  const displayRegionText = displayRegion || '未设置';
  const orderItems = orderTab === 'buyer' ? buyerOrders : sellerOrders;

  return (
    <PullToRefresh type="primary" disabled={refreshing} onRefresh={refresh}>
      <View className="container me-page">
      <View className="me-header">
        <View className="me-header-row">
          <View className="me-avatar-wrap">
            {auth.token && me ? (
              <Avatar
                size="72"
                src={me.avatarUrl || ''}
                icon={<Text className="me-avatar-text">{displayName.slice(0, 1)}</Text>}
              />
            ) : (
              <View className="me-avatar-placeholder">
                <Image className="me-avatar-icon" src={iconUser} svg mode="aspectFit" />
              </View>
            )}
          </View>
          <View className="me-header-meta">
            <View className="me-name-row">
              <Text className="me-name">{auth.token ? displayName : '未登录'}</Text>
              {verification.type ? <View className="me-tag me-tag-outline">{verificationTypeLabel(verification.type)}</View> : null}
              {verification.status ? (
                <View className="me-tag me-tag-status">{verificationStatusLabel(verification.status)}</View>
              ) : null}
            </View>
            {auth.token ? (
              <View className="me-info-row">
                <Text className="me-subtitle me-info-item">{displayPhone}</Text>
                <Text className="me-info-dot">·</Text>
                <Text className="me-subtitle me-info-item">地区：{displayRegionText}</Text>
              </View>
            ) : (
              <View className="me-status-row">
                <Text className="me-subtitle">登录后可进行咨询、下单和支付</Text>
              </View>
            )}
          </View>
        </View>

      </View>

      {!auth.token ? (
        <Surface className="me-login-card" padding="md">
          <Text className="me-login-title">请先登录</Text>
          <Text className="me-login-desc">登录并审核通过后，可进行收藏、咨询、下单与支付。</Text>
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

          <View className="me-order-card">
            <View className="me-order-tabs">
              <View
                className={`me-order-tab ${orderTab === 'buyer' ? 'active' : ''}`}
                onClick={() => setOrderTab('buyer')}
              >
                <Text>我买到的</Text>
                {orderTab === 'buyer' ? <View className="me-order-indicator" /> : null}
              </View>
              <View
                className={`me-order-tab ${orderTab === 'seller' ? 'active' : ''}`}
                onClick={() => setOrderTab('seller')}
              >
                <Text>我卖出的</Text>
                {orderTab === 'seller' ? <View className="me-order-indicator" /> : null}
              </View>
            </View>
            <View className="me-order-grid">
              {orderItems.map((item) => (
                <View key={item.key} className="me-order-item" onClick={item.onClick}>
                  <View className="me-order-icon">
                    <Image className="me-order-icon-img" src={item.icon} svg mode="aspectFit" />
                  </View>
                  <Text className="me-order-label">{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">发布管理</Text>
            </View>
            <View className="me-publish-grid">
              {publishItems.map((item) => (
                <View key={item.key} className="me-publish-item" onClick={item.onClick}>
                  <View className="me-publish-icon">
                    <Image className="me-publish-icon-img" src={item.icon} svg mode="aspectFit" />
                  </View>
                  <Text className="me-publish-label">{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">我的收藏</Text>
            </View>
            <View className="me-tools-list">
              {favoriteItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">消息与服务</Text>
            </View>
            <View className="me-tools-list">
              {serviceItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="me-section-card">
            <View className="me-section-header">
              <Text className="me-section-title">账号与合规</Text>
            </View>
            <View className="me-tools-list">
              {accountItems.map((item) => (
                <View key={item.key} className="me-tool-item" onClick={item.onClick}>
                  <View className="me-tool-left">
                    <View className="me-tool-icon">
                      <Image className="me-tool-icon-img" src={item.icon} svg mode="aspectFit" />
                    </View>
                    <Text className="me-tool-title">{item.label}</Text>
                  </View>
                  <View className="me-tool-right">
                    {item.value ? <Text className="me-tool-value">{item.value}</Text> : null}
                    <Text className="me-tool-arrow">›</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

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
        <Surface className="me-devtools-card" padding="md">
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
    </PullToRefresh>
  );
}

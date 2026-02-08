import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  setToken,
  setVerificationStatus,
  setVerificationType,
} from '../../lib/auth';
import { apiGet, apiPost } from '../../lib/api';
import { regionDisplayName } from '../../lib/regions';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';
import { WechatPhoneBindPopup } from '../../ui/WechatPhoneBindPopup';
import { Surface } from '../../ui/layout';
import { Avatar, Button, Input, PullToRefresh, toast } from '../../ui/nutui';
import fortuneGod from '../../assets/illustrations/fortune-god.svg';

import iconUser from '../../assets/icons/icon-user-purple.svg';
import iconPublishPatent from '../../assets/icons/icon-publish-patent.svg';
import iconPublishArtwork from '../../assets/icons/icon-publish-artwork.svg';
import iconPublishDemand from '../../assets/icons/icon-publish-demand.svg';
import iconPublishAchievement from '../../assets/icons/icon-publish-achievement.svg';
import iconOrderBuyer from '../../assets/icons/icon-order-buyer.svg';
import iconOrderSeller from '../../assets/icons/icon-order-seller.svg';
import iconContractCenter from '../../assets/icons/icon-contract-center.svg';
import iconInvoiceCenter from '../../assets/icons/icon-invoice-center.svg';
import iconNotification from '../../assets/icons/icon-notification.svg';
import iconMeFavorites from '../../assets/icons/icon-me-favorites.svg';
import iconMeCsCenter from '../../assets/icons/icon-me-cs-center.svg';
import iconMeAddress from '../../assets/icons/icon-me-address.svg';
import iconMeIdentity from '../../assets/icons/icon-me-identity.svg';
import iconMeProfile from '../../assets/icons/icon-me-profile.svg';
import iconMeAbout from '../../assets/icons/icon-me-about.svg';
import iconMeTradeRules from '../../assets/icons/icon-me-trade-rules.svg';

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
type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
type VerificationStatus = components['schemas']['VerificationStatus'];
type VerificationType = components['schemas']['VerificationType'];

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
  const env = useMemo(() => Taro.getEnv(), []);
  const canWechatLogin = env === Taro.ENV_TYPE.WEAPP;
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
  const [orderTab, setOrderTab] = useState<'orders' | 'publish'>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [phoneBindOpen, setPhoneBindOpen] = useState(false);
  const [phoneBindBusy, setPhoneBindBusy] = useState(false);
  const postLoginNextRef = useRef<null | (() => void)>(null);

  const [scenario, setScenario] = useState(() => Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  const afterLogin = useCallback(
    (authToken: AuthTokenResponse, opts?: { fromWechat?: boolean }) => {
      const token = authToken.accessToken || 'demo-token';
      setToken(token);

      const vt = (authToken.user?.verificationType || null) as VerificationType | null;
      const vs = (authToken.user?.verificationStatus || null) as VerificationStatus | null;
      const phoneFromAuth = String(authToken.user?.phone || '').trim();

      if (vt) setVerificationType(vt);
      else clearVerificationType();

      if (vs) setVerificationStatus(vs);
      else clearVerificationStatus();

      const onboardingDone = Boolean(vt) || isOnboardingDone();
      setOnboardingDone(onboardingDone);
      setAuth({
        token,
        onboardingDone,
        verificationType: vt,
        verificationStatus: vs,
      });

      toast('登录成功', { icon: 'success' });

      const goNext = () => {
        const pages = Taro.getCurrentPages();
        const canGoBack = pages.length > 1;

        const nextUrl = !vt ? '/pages/onboarding/choose-identity/index' : '/pages/home/index';

        if (!vt) {
          Taro.redirectTo({ url: nextUrl });
          return;
        }
        if (canGoBack) {
          Taro.navigateBack();
          return;
        }
        Taro.switchTab({ url: nextUrl });
      };

      const shouldPromptPhone = Boolean(opts?.fromWechat) && canWechatLogin && !phoneFromAuth;
      if (shouldPromptPhone) {
        postLoginNextRef.current = () => setTimeout(goNext, 200);
        setPhoneBindOpen(true);
        return;
      }

      setTimeout(goNext, 200);
    },
    [canWechatLogin],
  );

  const wechatLogin = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      let code = 'demo-code';
      try {
        const res = await Taro.login();
        if (res?.code) code = res.code;
      } catch (_) {
        // non-weapp env: fallback to demo code
      }

      const authToken = await apiPost<AuthTokenResponse>('/auth/wechat/mp-login', { code });
      afterLogin(authToken, { fromWechat: true });
    } catch (e: any) {
      toast(e?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy]);

  const sendSms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    if (!p) {
      toast('请输入手机号');
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ cooldownSeconds: number }>('/auth/sms/send', { phone: p, purpose: 'LOGIN' });
      setCooldown(Number(res?.cooldownSeconds || 60));
      toast('验证码已发送', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '发送失败');
    } finally {
      setBusy(false);
    }
  }, [busy, phone]);

  const verifySms = useCallback(async () => {
    if (busy) return;
    const p = phone.trim();
    const c = smsCode.trim();
    if (!p) {
      toast('请输入手机号');
      return;
    }
    if (!c) {
      toast('请输入验证码');
      return;
    }
    setBusy(true);
    try {
      const authToken = await apiPost<AuthTokenResponse>('/auth/sms/verify', { phone: p, code: c });
      afterLogin(authToken);
    } catch (e: any) {
      toast(e?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }, [afterLogin, busy, phone, smsCode]);

  const verification = useMemo(() => {
    return { type: auth.verificationType, status: auth.verificationStatus };
  }, [auth.verificationStatus, auth.verificationType]);

  const buildOrderUrl = useCallback((role: 'BUYER' | 'SELLER', opts?: { tab?: string; status?: string }) => {
    const base = `/pages/orders/index?role=${role}`;
    if (opts?.status) return `${base}&status=${encodeURIComponent(opts.status)}`;
    if (opts?.tab) return `${base}&tab=${encodeURIComponent(opts.tab)}`;
    return base;
  }, []);

  const orderManageItems = useMemo<IconItem[]>(
    () => [
      { key: 'buyer', label: '买家订单', icon: iconOrderBuyer, onClick: () => Taro.navigateTo({ url: buildOrderUrl('BUYER') }) },
      { key: 'seller', label: '卖家订单', icon: iconOrderSeller, onClick: () => Taro.navigateTo({ url: buildOrderUrl('SELLER') }) },
      { key: 'contract', label: '合同中心', icon: iconContractCenter, onClick: () => Taro.navigateTo({ url: '/pages/contracts/index' }) },
      { key: 'invoice', label: '发票管理', icon: iconInvoiceCenter, onClick: () => Taro.navigateTo({ url: '/pages/invoices/index' }) },
    ],
    [buildOrderUrl],
  );

  const publishItems = useMemo<IconItem[]>(
    () => [
      { key: 'listings', label: '我的专利', icon: iconPublishPatent, onClick: () => Taro.navigateTo({ url: '/pages/my-listings/index' }) },
      { key: 'artworks', label: '我的书画', icon: iconPublishArtwork, onClick: () => Taro.navigateTo({ url: '/pages/my-artworks/index' }) },
      { key: 'demands', label: '技术需求', icon: iconPublishDemand, onClick: () => Taro.navigateTo({ url: '/pages/my-demands/index' }) },
      { key: 'achievements', label: '成果案例', icon: iconPublishAchievement, onClick: () => Taro.navigateTo({ url: '/pages/my-achievements/index' }) },
    ],
    [],
  );

  const favoriteItems = useMemo<ToolItem[]>(
    () => [
      {
        key: 'favorites',
        label: '我的收藏',
        icon: iconMeFavorites,
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
        icon: iconMeCsCenter,
        onClick: () => Taro.navigateTo({ url: '/pages/support/index' }),
      },
      {
        key: 'notice',
        label: '通知',
        icon: iconNotification,
        onClick: () => Taro.navigateTo({ url: '/pages/notifications/index' }),
      },
      {
        key: 'address',
        label: '地址管理',
        icon: iconMeAddress,
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
        icon: iconMeIdentity,
        onClick: () => Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' }),
      },
      {
        key: 'profile',
        label: '资料设置',
        icon: iconMeProfile,
        onClick: () => Taro.navigateTo({ url: '/pages/profile/edit/index' }),
      },
      {
        key: 'about',
        label: '关于与合规',
        icon: iconMeAbout,
        onClick: () => Taro.navigateTo({ url: '/pages/about/index' }),
      },
      {
        key: 'rules',
        label: '交易规则',
        icon: iconMeTradeRules,
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
  const orderItems = orderTab === 'orders' ? orderManageItems : publishItems;

  if (!auth.token) {
    return (
      <View className="container me-page me-page-locked page-locked">
        <View className="me-login-wrap">
          <Image className="me-login-ill" src={fortuneGod} svg mode="aspectFit" />
          <Text className="me-login-title">登录解锁专利点金台</Text>
          <View className={`me-login-actions ${showSms ? 'is-expanded' : ''}`}>
            <Button
              className="me-login-btn me-login-btn-phone"
              variant="default"
              onClick={() => setShowSms((v) => !v)}
            >
              手机号登录
            </Button>
            {canWechatLogin ? (
              <Button
                className="me-login-btn me-login-btn-wechat"
                variant="default"
                loading={busy}
                disabled={busy}
                onClick={() => void wechatLogin()}
              >
                微信登录
              </Button>
            ) : null}
          </View>
          {showSms ? (
            <View className="me-login-panel">
              <View className="me-login-field">
                <Text className="me-login-label">手机号</Text>
                <View className="me-login-input">
                  <Input value={phone} onChange={setPhone} placeholder="请输入手机号" type="digit" clearable />
                </View>
              </View>

              <View style={{ height: '10rpx' }} />
              <Button
                className="me-login-send"
                variant="default"
                loading={busy}
                disabled={busy || cooldown > 0}
                onClick={() => void sendSms()}
              >
                {cooldown > 0 ? `重新发送(${cooldown}s)` : '发送验证码'}
              </Button>

              <View style={{ height: '12rpx' }} />
              <View className="me-login-field">
                <Text className="me-login-label">验证码</Text>
                <View className="me-login-input">
                  <Input value={smsCode} onChange={setSmsCode} placeholder="请输入短信验证码" type="digit" clearable />
                </View>
              </View>

              <View style={{ height: '12rpx' }} />
              <Button className="me-login-submit" loading={busy} disabled={busy} onClick={() => void verifySms()}>
                登录
              </Button>
            </View>
          ) : null}
          <View className="me-login-agreement">
            <Text className="me-login-agreement-text">登录即同意</Text>
            <Text className="me-login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/legal/terms/index' })}>
              《用户协议》
            </Text>
            <Text className="me-login-agreement-text">和</Text>
            <Text className="me-login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy/index' })}>
              《隐私政策》
            </Text>
          </View>
        </View>
      </View>
    );
  }

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

      <>
        {meLoading ? <LoadingCard text="加载我的资料…" /> : null}
        {meError ? <ErrorCard message={meError} onRetry={loadMe} /> : null}

          <View className="me-order-card">
            <View className="me-order-tabs">
              <View
                className={`me-order-tab ${orderTab === 'orders' ? 'active' : ''}`}
                onClick={() => setOrderTab('orders')}
              >
                <Text>订单管理</Text>
                {orderTab === 'orders' ? <View className="me-order-indicator" /> : null}
              </View>
              <View
                className={`me-order-tab ${orderTab === 'publish' ? 'active' : ''}`}
                onClick={() => setOrderTab('publish')}
              >
                <Text>发布管理</Text>
                {orderTab === 'publish' ? <View className="me-order-indicator" /> : null}
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

      <WechatPhoneBindPopup
        visible={phoneBindOpen}
        loading={phoneBindBusy}
        onSkip={() => {
          setPhoneBindOpen(false);
          const next = postLoginNextRef.current;
          postLoginNextRef.current = null;
          next?.();
        }}
        onRequestBind={async (phoneCode) => {
          if (phoneBindBusy) return;
          setPhoneBindBusy(true);
          try {
            await apiPost('/auth/wechat/phone-bind', { phoneCode });
            toast('手机号绑定成功', { icon: 'success' });
            setPhoneBindOpen(false);
            const next = postLoginNextRef.current;
            postLoginNextRef.current = null;
            next?.();
          } catch (e: any) {
            toast(e?.message || '绑定失败');
          } finally {
            setPhoneBindBusy(false);
          }
        }}
      />
      </View>
    </PullToRefresh>
  );
}

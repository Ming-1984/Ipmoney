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
import { CellRow, PageHeader, Spacer, Surface } from '../../ui/layout';
import { Avatar, Button, CellGroup, Tag, toast } from '../../ui/nutui';

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

  return (
    <View className="container">
      <PageHeader title="我的" />
      <Spacer />

      {!auth.token ? (
        <Surface>
          <Text className="text-card-title">未登录</Text>
          <View style={{ height: '8rpx' }} />
          <Text className="muted">登录并审核通过后，可进行收藏/咨询/下单/支付。</Text>
          <View style={{ height: '14rpx' }} />
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            微信授权登录
          </Button>
        </Surface>
      ) : (
        <View>
          {meLoading ? <LoadingCard text="加载我的资料…" /> : null}
          {meError ? <ErrorCard message={meError} onRetry={loadMe} /> : null}
          {me && !meLoading && !meError ? (
            <Surface>
              <View className="row" style={{ gap: '14rpx' }}>
                <Avatar
                  size="64"
                  src={me.avatarUrl || ''}
                  icon={<Text className="text-strong">{(me.nickname || '用').slice(0, 1)}</Text>}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View className="row-between" style={{ gap: '12rpx' }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text className="text-card-title">{me.nickname || '未设置昵称'}</Text>
                      <View style={{ height: '6rpx' }} />
                      <Text className="muted">{me.phone || '未绑定手机号'}</Text>
                    </View>
                    <View className="row" style={{ gap: '8rpx', flexShrink: 0 }}>
                      {verification.status ? (
                        <Tag type={verificationStatusTagType(verification.status)} plain round>
                          {verificationStatusLabel(verification.status)}
                        </Tag>
                      ) : null}
                      <Tag type="primary" plain round>
                        {verificationTypeLabel(verification.type)}
                      </Tag>
                    </View>
                  </View>
                  <View style={{ height: '6rpx' }} />
                  <Text className="muted">地区：{me.regionCode || '未设置'}</Text>

                  <View style={{ height: '12rpx' }} />
                  <View className="row" style={{ gap: '12rpx' }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => {
                          Taro.navigateTo({ url: '/pages/profile/edit/index' });
                        }}
                      >
                        {!me.avatarUrl || !me.nickname ? '完善资料' : '资料设置'}
                      </Button>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => {
                          void syncVerification();
                        }}
                      >
                        刷新认证
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            </Surface>
          ) : null}

          <View style={{ height: '12rpx' }} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                clickable
                title={<Text className="text-strong">我的订单</Text>}
                description={<Text className="muted">查看订金/尾款/退款进度</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/orders/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">我的收藏</Text>}
                description={<Text className="muted">已收藏的专利/需求/成果</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/favorites/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">我的专利上架</Text>}
                description={<Text className="muted">卖家管理草稿/上架/下架</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-listings/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">我的需求</Text>}
                description={<Text className="muted">发布方管理草稿/审核/下架</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-demands/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">我的成果</Text>}
                description={<Text className="muted">发布方管理草稿/审核/下架</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/my-achievements/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">身份/认证</Text>}
                description={<Text className="muted">首次进入必选，企业/院校通过后可展示</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">咨询/消息</Text>}
                description={<Text className="muted">查看会话与跟单</Text>}
                onClick={() => {
                  Taro.switchTab({ url: '/pages/messages/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">机构展示</Text>}
                description={<Text className="muted">企业/科研院校入驻展示</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/organizations/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">交易规则</Text>}
                description={<Text className="muted">订金/佣金/退款窗口等</Text>}
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/trade-rules/index' });
                }}
              />
              <CellRow
                clickable
                title={<Text className="text-strong">资料设置</Text>}
                description={<Text className="muted">昵称/地区等</Text>}
                isLast
                onClick={() => {
                  Taro.navigateTo({ url: '/pages/profile/edit/index' });
                }}
              />
            </CellGroup>
          </Surface>

          <View style={{ height: '12rpx' }} />

          <Surface>
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
        </View>
      )}

      {ENABLE_MOCK_TOOLS && APP_MODE === 'development' ? (
        <>
          <View style={{ height: '16rpx' }} />
          <Surface>
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
        </>
      ) : null}
    </View>
  );
}

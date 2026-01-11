import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { STORAGE_KEYS } from '../../constants';
import {
  clearToken,
  getToken,
  getVerificationStatus,
  getVerificationType,
  isOnboardingDone,
} from '../../lib/auth';
import { apiGet } from '../../lib/api';
import { ErrorCard, LoadingCard } from '../../ui/StateCards';

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

export default function MePage() {
  const token = getToken();
  const onboardingDone = isOnboardingDone();
  const verification = useMemo(() => {
    return {
      type: getVerificationType(),
      status: getVerificationStatus(),
    };
  }, []);

  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const scenario = useMemo(() => Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy', []);

  const loadMe = useCallback(async () => {
    if (!token) return;
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
  }, [token]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>我的</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">登录态：{token ? '已登录（演示 token）' : '未登录'}</Text>
        <View style={{ height: '4rpx' }} />
        <Text className="muted">
          身份：{verification.type ?? '-'} / 状态：{verification.status ?? '-'}
        </Text>
        <View style={{ height: '4rpx' }} />
        <Text className="muted">首次进入完成：{onboardingDone ? '是' : '否'}</Text>
        <View style={{ height: '4rpx' }} />
        <Text className="muted">Mock 场景：{scenario}</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      {!token ? (
        <View
          className="card btn-primary"
          onClick={() => {
            Taro.navigateTo({ url: '/pages/login/index' });
          }}
        >
          <Text>登录/注册</Text>
        </View>
      ) : (
        <View>
          {meLoading ? <LoadingCard text="加载我的资料…" /> : null}
          {meError ? <ErrorCard message={meError} onRetry={loadMe} /> : null}
          {me && !meLoading && !meError ? (
            <View className="card">
              <Text style={{ fontWeight: 700 }}>{me.nickname || '演示用户'}</Text>
              <View style={{ height: '6rpx' }} />
              <Text className="muted">地区：{me.regionCode || '-'}</Text>
            </View>
          ) : null}

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.navigateTo({ url: '/pages/onboarding/choose-identity/index' });
            }}
          >
            <Text>身份/认证（首次进入必选）</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.switchTab({ url: '/pages/messages/index' });
            }}
          >
            <Text>我的咨询/消息</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              Taro.navigateTo({ url: '/pages/organizations/index' });
            }}
          >
            <Text>机构展示</Text>
          </View>

          <View style={{ height: '12rpx' }} />

          <View
            className="card btn-ghost"
            onClick={() => {
              clearToken();
              Taro.showToast({ title: '已退出登录', icon: 'success' });
              setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 200);
            }}
          >
            <Text>退出登录</Text>
          </View>
        </View>
      )}

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>演示：切换 Mock 场景</Text>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'happy');
            Taro.showToast({ title: '已切换：happy', icon: 'success' });
          }}
        >
          <Text>happy（默认）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'empty');
            Taro.showToast({ title: '已切换：empty', icon: 'success' });
          }}
        >
          <Text>empty（空数据）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'error');
            Taro.showToast({ title: '已切换：error', icon: 'success' });
          }}
        >
          <Text>error（服务异常）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'edge');
            Taro.showToast({ title: '已切换：edge', icon: 'success' });
          }}
        >
          <Text>edge（边界数据）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'payment_callback_replay');
            Taro.showToast({ title: '已切换：payment_callback_replay', icon: 'success' });
          }}
        >
          <Text>payment_callback_replay（幂等冲突）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'refund_failed');
            Taro.showToast({ title: '已切换：refund_failed', icon: 'success' });
          }}
        >
          <Text>refund_failed（退款失败）</Text>
        </View>
        <View style={{ height: '10rpx' }} />
        <View
          className="btn-ghost"
          onClick={() => {
            Taro.setStorageSync(STORAGE_KEYS.mockScenario, 'order_conflict');
            Taro.showToast({ title: '已切换：order_conflict', icon: 'success' });
          }}
        >
          <Text>order_conflict（状态机冲突）</Text>
        </View>
      </View>
    </View>
  );
}

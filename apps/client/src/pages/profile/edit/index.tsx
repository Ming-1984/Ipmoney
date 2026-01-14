import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet, apiPatch } from '../../../lib/api';
import { requireLogin } from '../../../lib/guard';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Button, Input } from '../../../ui/nutui';
import { ErrorCard, LoadingCard } from '../../../ui/StateCards';

type UserProfile = components['schemas']['UserProfile'];

export default function ProfileEditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);

  const [nickname, setNickname] = useState('');
  const [regionCode, setRegionCode] = useState('');

  const load = useCallback(async () => {
    if (!requireLogin()) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<UserProfile>('/me');
      setMe(d);
      setNickname(d.nickname || '');
      setRegionCode(d.regionCode || '');
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!requireLogin()) return;
    try {
      const d = await apiPatch<UserProfile>('/me', {
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
      });
      setMe(d);
      Taro.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 200);
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' });
    }
  }, [nickname, regionCode]);

  return (
    <View className="container">
      <PageHeader title="资料设置" subtitle="更新昵称/地区，用于地域推荐与展示" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : (
        <View>
          <Surface>
            <Text className="muted">昵称</Text>
            <View style={{ height: '8rpx' }} />
            <Input value={nickname} onChange={setNickname} placeholder="设置昵称（可选）" clearable />

            <View style={{ height: '12rpx' }} />
            <Text className="muted">地区（adcode，可选）</Text>
            <View style={{ height: '8rpx' }} />
            <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
              <View className="flex-1">
                <Input value={regionCode} onChange={setRegionCode} placeholder="例如：110000" clearable />
              </View>
              <View style={{ width: '180rpx' }}>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    Taro.navigateTo({
                      url: '/pages/region-picker/index',
                      success: (res) => {
                        res.eventChannel.on('regionSelected', (v: any) => {
                          if (v?.code) setRegionCode(String(v.code));
                        });
                      },
                    });
                  }}
                >
                  选择
                </Button>
              </View>
            </View>
          </Surface>

          <View style={{ height: '16rpx' }} />

          <Surface>
            <Button onClick={() => void save()}>保存</Button>
          </Surface>

          {me?.phone ? (
            <>
              <View style={{ height: '16rpx' }} />
              <Surface>
                <Text className="muted">手机号：{me.phone}</Text>
              </Surface>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

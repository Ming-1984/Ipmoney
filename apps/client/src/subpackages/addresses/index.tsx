import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import { apiGet, apiPatch } from '../../lib/api';
import { usePageAccess } from '../../lib/guard';
import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard } from '../../ui/StateCards';
import { AccessGate } from '../../ui/PageState';

type Address = {
  id: string;
  name: string;
  phone: string;
  regionCode?: string | null;
  addressLine: string;
  isDefault?: boolean;
};

export default function AddressManagePage() {
  const access = usePageAccess('login-required');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const addAddress = useCallback(() => {
    Taro.navigateTo({ url: '/subpackages/addresses/edit/index' });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<Address[]>('/me/addresses');
      setAddresses(list || []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access.state !== 'ok') return;
    void load();
  }, [access.state, load]);

  useDidShow(() => {
    if (access.state !== 'ok') return;
    void load();
  });

  const setDefault = useCallback(
    async (addressId: string) => {
      try {
        await apiPatch(`/me/addresses/${addressId}`, { isDefault: true });
        toast('已设为默认');
        void load();
      } catch (e: any) {
        toast(e?.message || '设置失败');
      }
    },
    [load],
  );

  const list = useMemo(() => addresses || [], [addresses]);

  return (
    <View className="container address-page">
      <PageHeader weapp title="地址管理" subtitle="合同寄送/收货地址" />
      <Spacer />

      {access.state !== 'ok' ? (
        <AccessGate access={access} />
      ) : (
        <>
          <Button onClick={addAddress}>新增地址</Button>
          <Spacer size={12} />

          {loading ? (
            <LoadingCard text="地址加载中" />
          ) : error ? (
            <ErrorCard message={error} onRetry={load} />
          ) : list.length ? (
            <View className="address-list">
              {list.map((addr) => (
                <Surface key={addr.id} className="address-card" padding="none">
                  <View className="row-between">
                    <Text className="text-strong">{addr.name}</Text>
                    {addr.isDefault ? <Text className="address-tag">默认</Text> : null}
                  </View>
                  <Text className="muted">{addr.phone}</Text>
                  <Text className="muted">{addr.regionCode || '-'}</Text>
                  <Text className="muted">{addr.addressLine}</Text>
                  <View className="address-actions">
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => Taro.navigateTo({ url: `/subpackages/addresses/edit/index?id=${addr.id}` })}
                    >
                      编辑
                    </Button>
                    {!addr.isDefault ? (
                      <Button size="small" variant="ghost" onClick={() => void setDefault(addr.id)}>
                        设为默认
                      </Button>
                    ) : null}
                  </View>
                </Surface>
              ))}
            </View>
          ) : (
            <EmptyCard message="暂无地址" actionText="新增地址" onAction={addAddress} />
          )}
        </>
      )}
    </View>
  );
}

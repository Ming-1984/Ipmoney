import { View, Text } from '@tarojs/components';
import React, { useCallback, useMemo, useState } from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Button, toast } from '../../ui/nutui';


type Address = {
  id: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault?: boolean;
};

export default function AddressManagePage() {
  const [addresses] = useState<Address[]>([]);

  const addAddress = useCallback(() => {
    toast('地址管理功能开发中', { icon: 'fail' });
  }, []);

  const list = useMemo(() => addresses || [], [addresses]);

  return (
    <View className="container address-page">
      <PageHeader weapp title="地址管理" subtitle="合同寄送/收货地址" />
      <Spacer />

      {list.length ? (
        <View className="address-list">
          {list.map((addr) => (
            <Surface key={addr.id} className="address-card" padding="none">
              <View className="row-between">
                <Text className="text-strong">{addr.name}</Text>
                {addr.isDefault ? <Text className="address-tag">默认</Text> : null}
              </View>
              <Text className="muted">{addr.phone}</Text>
              <Text className="muted">{addr.region}</Text>
              <Text className="muted">{addr.detail}</Text>
              <View className="address-actions">
                <Button size="small" variant="ghost" onClick={addAddress}>
                  编辑
                </Button>
                <Button size="small" variant="ghost" onClick={addAddress}>
                  设为默认
                </Button>
              </View>
            </Surface>
          ))}
        </View>
      ) : (
        <Surface className="address-empty" padding="md">
          <Text className="text-strong">暂无地址</Text>
          <Text className="muted">用于合同寄送与收货联系</Text>
          <View style={{ height: '16rpx' }} />
          <Button variant="primary" onClick={addAddress}>
            新增地址
          </Button>
        </Surface>
      )}
    </View>
  );
}

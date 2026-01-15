import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { getToken } from '../../../lib/auth';
import { apiGet } from '../../../lib/api';
import { orderStatusLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { Button, Step, Steps, Space, Tag } from '../../../ui/nutui';
import { PageHeader, SectionHeader, Spacer, StickyBar, Surface, TipBanner } from '../../../ui/layout';
import { LoadingCard, MissingParamCard, PermissionCard } from '../../../ui/StateCards';

type Order = components['schemas']['Order'];

export default function DepositSuccessPage() {
  const orderId = useRouteUuidParam('orderId') || '';
  const paymentId = useRouteUuidParam('paymentId') || '';
  const token = getToken();

  if (!orderId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<Order>(`/orders/${orderId}`);
      setOrder(d);
    } catch (_) {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [load, token]);

  return (
    <View className="container has-sticky">
      <PageHeader title="订金支付成功" subtitle={`支付单号：${paymentId || '-'}`} />
      <Spacer />

      {!token ? (
        <PermissionCard
          title="需要登录"
          message="登录后查看订单信息。"
          actionText="去登录"
          onAction={() => Taro.navigateTo({ url: '/pages/login/index' })}
        />
      ) : loading ? (
        <LoadingCard text="加载订单中…" />
      ) : (
        <View>
          <TipBanner tone="success" title="支付成功">
            订金已托管，平台会开始跟单与材料核验。
          </TipBanner>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="订单摘要" density="compact" />
            <Spacer size={8} />
            <Space wrap align="center">
              <Tag type="default" plain round style={{ maxWidth: '100%' }}>
                <Text className="clamp-1">订单：{order?.id || '-'}</Text>
              </Tag>
              <Tag type="primary" plain round>
                状态：{order?.status ? orderStatusLabel(order.status) : '未知'}
              </Tag>
              <Tag type="primary" plain round>
                订金：{order?.depositAmountFen !== undefined ? `¥${fenToYuan(order.depositAmountFen)}` : '-'}
              </Tag>
            </Space>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <View className="row-between">
              <SectionHeader title="下一步" subtitle="关键节点会在平台内留痕，减少争议。" density="compact" />
              <Text className="tag tag-gold">流程</Text>
            </View>
            <Spacer size={8} />
            <Steps direction="vertical" value={1} type="text">
              {[
                '平台开始跟单与材料核验',
                '双方线下签署合同（转让/许可）',
                '后台确认合同后解锁尾款支付',
                '权属变更完成（证据归档）',
                '财务确认后放款/结算',
              ].map((t, idx) => (
                <Step key={t} value={idx + 1} title={t} />
              ))}
            </Steps>
          </Surface>

          <StickyBar>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
                进入消息
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onClick={() => {
                  if (!orderId) return;
                  Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
                }}
              >
                查看订单
              </Button>
            </View>
          </StickyBar>
        </View>
      )}
    </View>
  );
}

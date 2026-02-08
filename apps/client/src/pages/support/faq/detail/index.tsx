import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';
import './index.scss';

import { useRouteStringParam } from '../../../../lib/routeParams';
import { MissingParamCard } from '../../../../ui/StateCards';
import { PageHeader, Spacer, Surface } from '../../../../ui/layout';
import { Cell } from '../../../../ui/nutui';
import { FAQS } from '../data';

export default function SupportFaqDetailPage() {
  const id = useRouteStringParam('id');
  const item = useMemo(() => FAQS.find((it) => it.id === id) || null, [id]);

  if (!id) {
    return (
      <View className="container faq-detail-page">
        <PageHeader weapp back title="常见问题" subtitle="问题详情" />
        <Spacer />
        <MissingParamCard
          message="缺少问题编号，请返回常见问题列表重新进入。"
          actionText="返回列表"
          onAction={() => Taro.navigateBack()}
        />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="container faq-detail-page">
        <PageHeader weapp back title="常见问题" subtitle="问题详情" />
        <Spacer />
        <Surface className="faq-detail-card">
          <Text className="faq-detail-q">该问题不存在或已下线</Text>
          <Text className="faq-detail-meta">你可以返回列表重新选择，或直接电话联系客服。</Text>
        </Surface>
        <Spacer size={12} />
        <Surface className="faq-detail-actions">
          <Cell title="返回常见问题" extra="返回" onClick={() => Taro.navigateBack()} />
          <Cell title="联系客服" extra="电话" onClick={() => Taro.navigateTo({ url: '/pages/support/contact/index' })} />
        </Surface>
      </View>
    );
  }

  return (
    <View className="container faq-detail-page">
      <PageHeader weapp back title="常见问题" subtitle={item.category} />
      <Spacer />

      <Surface className="faq-detail-card">
        <Text className="faq-detail-q">{item.q}</Text>
        <Text className="faq-detail-meta">分类：{item.category}</Text>
        <Text className="faq-detail-a">{item.a}</Text>
      </Surface>

      <Spacer size={12} />

      <Surface className="faq-detail-actions">
        <Cell title="交易规则" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/trade-rules/index' })} />
        <Cell title="联系客服" extra="电话" onClick={() => Taro.navigateTo({ url: '/pages/support/contact/index' })} />
      </Surface>
    </View>
  );
}


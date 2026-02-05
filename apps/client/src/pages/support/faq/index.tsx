import { View, Text } from '@tarojs/components';
import React from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';

const FAQS = [
  { q: '为什么合同要线下签？', a: '平台采用线下合同 + 线上资金托管，降低电子签与身份核验成本。' },
  { q: '订金能退吗？', a: '订金支付后 30 分钟内且客服未介入可无理由退订金；进入跟单后按规则处理。' },
  { q: '尾款什么时候能支付？', a: '后台确认合同签署后解锁尾款支付入口。' },
  { q: '发票怎么开？', a: '订单完成后平台可为服务费开具电子发票，平台内下载。' },
];

export default function SupportFaqPage() {
  return (
    <View className="container settings-page">
      <PageHeader weapp back title="常见问题" subtitle="交易与规则说明" />
      <Spacer />

      <View className="faq-list">
        {FAQS.map((item, idx) => (
          <Surface key={`${item.q}-${idx}`} className="faq-card">
            <Text className="faq-q">Q：{item.q}</Text>
            <Text className="faq-a">A：{item.a}</Text>
          </Surface>
        ))}
      </View>
    </View>
  );
}

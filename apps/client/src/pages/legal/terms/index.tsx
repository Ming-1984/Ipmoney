import { View, Text } from '@tarojs/components';
import React from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';

const SECTIONS = [
  {
    title: '服务协议',
    body: '本协议用于说明你在使用平台服务时的权利义务，包括交易、咨询、发布等行为规范。',
  },
  {
    title: '交易规则',
    body: '订金用于锁定意向，尾款在合同签署确认后支付并托管，变更完成后结算放款。',
  },
  {
    title: '违规处理',
    body: '平台禁止引导线下交易、虚假发布与侵权行为，违规将按规则处理。',
  },
];

export default function TermsPage() {
  return (
    <View className="container legal-page">
      <PageHeader weapp back title="服务协议" subtitle="平台服务使用规则" />
      <Spacer />
      <View className="legal-list">
        {SECTIONS.map((section, idx) => (
          <Surface key={`${section.title}-${idx}`} className="legal-card">
            <Text className="legal-title">{section.title}</Text>
            <Text className="legal-body">{section.body}</Text>
          </Surface>
        ))}
      </View>
    </View>
  );
}

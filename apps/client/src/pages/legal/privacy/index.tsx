import { View, Text } from '@tarojs/components';
import React from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';

const SECTIONS = [
  {
    title: '隐私政策',
    body: '本政策用于说明我们如何收集、使用、存储与保护你的个人信息。详细条款以平台正式发布版本为准。',
  },
  {
    title: '信息收集与使用',
    body: '为提供登录、咨询、交易与消息服务，我们会收集必要的账号信息与业务数据，并用于服务提供与风险控制。',
  },
  {
    title: '信息共享',
    body: '仅在交易履约或法律法规要求的情况下共享必要信息，且会尽力保护你的隐私。',
  },
];

export default function PrivacyPage() {
  return (
    <View className="container legal-page">
      <PageHeader weapp back title="隐私政策" subtitle="平台隐私与信息保护" />
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

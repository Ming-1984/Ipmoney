import { View, Text } from '@tarojs/components';
import React from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../../ui/layout';

const SECTIONS = [
  {
    title: '用户隐私保护指引',
    body: '为确保你的知情权与选择权，本指引说明小程序中涉及个人信息的使用场景与授权方式。',
  },
  {
    title: '必要权限说明',
    body: '在登录、咨询、交易等场景中，平台可能需要获取头像昵称、联系方式等信息。',
  },
  {
    title: '撤回授权',
    body: '你可在微信系统设置中撤回授权，撤回后可能影响部分功能使用。',
  },
];

export default function PrivacyGuidePage() {
  return (
    <View className="container legal-page">
      <PageHeader weapp back title="用户隐私保护指引" subtitle="小程序隐私说明" />
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

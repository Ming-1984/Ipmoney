import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo } from 'react';
import './index.scss';

import { PageHeader, Spacer, Surface } from '../../ui/layout';
import { Cell } from '../../ui/nutui';

function envLabel(env?: string): string {
  if (!env) return '';
  if (env === 'develop') return '开发版';
  if (env === 'trial') return '体验版';
  if (env === 'release') return '正式版';
  return env;
}

export default function AboutPage() {
  const versionLabel = useMemo(() => {
    try {
      if (typeof Taro.getAccountInfoSync === 'function') {
        const info = Taro.getAccountInfoSync();
        const miniProgram = info?.miniProgram;
        const env = envLabel(miniProgram?.envVersion);
        if (miniProgram?.version && env) return `${miniProgram.version}（${env}）`;
        if (miniProgram?.version) return miniProgram.version;
        if (env) return env;
      }
    } catch (_) {
      // ignore
    }
    return '—';
  }, []);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="关于与合规" subtitle="隐私与服务协议" />
      <Spacer />

      <Surface className="settings-card">
        <Cell title="隐私政策" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/legal/privacy/index' })} />
        <Cell title="服务协议" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/legal/terms/index' })} />
        <Cell title="交易规则" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/trade-rules/index' })} />
      </Surface>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="平台介绍" extra="查看" onClick={() => Taro.showModal({ title: '平台介绍', content: '平台为知识产权交易提供流程管理、资金托管与风险管控服务。', showCancel: false })} />
        <Cell title="当前版本" extra={versionLabel} />
      </Surface>

      <Spacer size={12} />
      <Surface className="settings-tip">
        <Text className="settings-tip-text">如需进一步了解合规与隐私处理方式，请查看相关说明或联系平台客服。</Text>
      </Surface>
    </View>
  );
}

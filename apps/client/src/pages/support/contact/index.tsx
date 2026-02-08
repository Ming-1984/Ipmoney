import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import './index.scss';

import { apiGet } from '../../../lib/api';
import { PageHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Cell, toast } from '../../../ui/nutui';

type CustomerServiceConfig = {
  phone: string;
  defaultReply?: string;
  assignStrategy?: 'AUTO' | 'MANUAL';
};

const FALLBACK_PHONE = '400-000-0000';

export default function SupportContactPage() {
  const [phone, setPhone] = useState(FALLBACK_PHONE);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<CustomerServiceConfig>('/public/config/customer-service');
      if (d?.phone && String(d.phone).trim()) setPhone(String(d.phone).trim());
    } catch {
      // Keep fallback phone in offline/demo mode or when config isn't ready.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const makeCall = useCallback(async () => {
    try {
      await Taro.makePhoneCall({ phoneNumber: phone });
    } catch (e: any) {
      toast(e?.message || '无法发起拨号，请手动拨打。');
    }
  }, [phone]);

  const copyPhone = useCallback(async () => {
    try {
      await Taro.setClipboardData({ data: phone });
      toast('已复制号码', { icon: 'success' });
    } catch {
      toast('复制失败');
    }
  }, [phone]);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="联系客服" subtitle="电话咨询与售后支持" />
      <Spacer />

      <TipBanner tone="info" title="服务提示">
        客服工作时间：工作日 09:00-18:00，非工作时间可提交意见反馈，我们将尽快处理。
      </TipBanner>

      <Spacer size={12} />

      <Surface className="settings-card">
        <Cell title="客服热线" extra={phone} onClick={() => void makeCall()} />
        <Cell title="复制号码" extra="复制" onClick={() => void copyPhone()} />
        <Text className="cs-hint">如遇交易纠纷或紧急问题，建议优先电话沟通并保留相关材料。</Text>
      </Surface>
    </View>
  );
}

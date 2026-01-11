import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';

import { apiPost } from '../../../lib/api';
import { ensureOnboarding } from '../../../lib/guard';

type PatentNormalizeResponse = {
  jurisdiction: 'CN';
  inputType: 'APPLICATION_NO' | 'PATENT_NO' | 'PUBLICATION_NO';
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  publicationNoNorm?: string;
  publicationNoDisplay?: string;
  patentNoNorm?: string;
  patentNoDisplay?: string;
  patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
};

export default function PublishPatentPage() {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<PatentNormalizeResponse | null>(null);

  const summary = useMemo(() => {
    if (!result) return null;
    return {
      inputType: result.inputType,
      patentType: result.patentType,
      applicationNoDisplay: result.applicationNoDisplay,
      publicationNoDisplay: result.publicationNoDisplay,
      patentNoDisplay: result.patentNoDisplay,
    };
  }, [result]);

  return (
    <View className="container">
      <View className="card">
        <Text style={{ fontSize: '34rpx', fontWeight: 700 }}>发布：专利交易</Text>
        <View style={{ height: '8rpx' }} />
        <Text className="muted">P0：用户上传/后台录入为准；此处先做表单与号码规范化演示。</Text>
      </View>

      <View style={{ height: '16rpx' }} />

      <View className="card">
        <Text style={{ fontWeight: 700 }}>专利号/申请号</Text>
        <View style={{ height: '8rpx' }} />
        <Input
          value={raw}
          onInput={(e) => setRaw(e.detail.value)}
          placeholder="例如：202311340972.0 / CN2023xxxxxx.x"
        />
        <View style={{ height: '12rpx' }} />
        <View
          className="btn-ghost"
          onClick={async () => {
            if (!raw.trim()) {
              Taro.showToast({ title: '请先输入号码', icon: 'none' });
              return;
            }
            try {
              const r = await apiPost<PatentNormalizeResponse>('/patents/normalize', { raw });
              setResult(r);
              Taro.showToast({ title: '解析成功', icon: 'success' });
            } catch (e: any) {
              setResult(null);
              Taro.showToast({ title: e?.message || '解析失败', icon: 'none' });
            }
          }}
        >
          <Text>解析与规范化（演示）</Text>
        </View>

        {summary ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="muted">类型：{summary.patentType || '-'}</Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">输入类型：{summary.inputType}</Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">申请号：{summary.applicationNoDisplay || '-'}</Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">公开(公告)号：{summary.publicationNoDisplay || '-'}</Text>
            <View style={{ height: '4rpx' }} />
            <Text className="muted">专利号：{summary.patentNoDisplay || '-'}</Text>
          </>
        ) : null}
      </View>

      <View style={{ height: '16rpx' }} />

      <View
        className="card btn-primary"
        onClick={() => {
          if (!ensureOnboarding()) return;
          Taro.showToast({ title: '已提交审核（演示）', icon: 'success' });
          setTimeout(() => {
            Taro.switchTab({ url: '/pages/me/index' });
          }, 200);
        }}
      >
        <Text>提交发布（演示）</Text>
      </View>
    </View>
  );
}

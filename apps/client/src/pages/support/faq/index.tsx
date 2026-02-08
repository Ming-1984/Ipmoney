import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import './index.scss';

import { FAQS } from './data';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Cell, Input } from '../../../ui/nutui';

export default function SupportFaqPage() {
  const [q, setQ] = useState('');

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return FAQS;
    const t = trimmed.toLowerCase();
    return FAQS.filter((it) => {
      const hay = `${it.q} ${it.category} ${(it.keywords || []).join(' ')}`.toLowerCase();
      return hay.includes(t);
    });
  }, [trimmed]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const it of filtered) {
      const arr = map.get(it.category) || [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <View className="container settings-page">
      <PageHeader weapp back title="常见问题" subtitle="问题解答与规则说明" />
      <Spacer />

      <Surface className="faq-search-card">
        <Input value={q} onChange={setQ} placeholder="搜索问题" clearable />
      </Surface>

      <Spacer size={12} />

      {grouped.length ? (
        grouped.map(([category, items]) => (
          <View key={category}>
            <Text className="faq-section-title">{category}</Text>
            <Spacer size={8} />
            <Surface className="settings-card">
              {items.map((it) => (
                <Cell
                  key={it.id}
                  title={it.q}
                  extra="查看"
                  onClick={() => Taro.navigateTo({ url: `/pages/support/faq/detail/index?id=${encodeURIComponent(it.id)}` })}
                />
              ))}
            </Surface>
            <Spacer size={12} />
          </View>
        ))
      ) : (
        <Surface className="faq-empty">
          <Text className="faq-empty-title">未找到相关问题</Text>
          <Text className="faq-empty-sub">换个关键词试试，或返回联系客服。</Text>
        </Surface>
      )}

      <Surface className="faq-bottom-card">
        <Cell title="交易规则" extra="查看" onClick={() => Taro.navigateTo({ url: '/pages/trade-rules/index' })} />
        <Cell title="联系客服" extra="电话" onClick={() => Taro.navigateTo({ url: '/pages/support/contact/index' })} />
      </Surface>
    </View>
  );
}

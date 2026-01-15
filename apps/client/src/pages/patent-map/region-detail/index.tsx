import { View, Text } from '@tarojs/components';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteNumberParam, useRouteStringParam } from '../../../lib/routeParams';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface } from '../../../ui/layout';
import { CellGroup, Space, Tag } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type PatentMapRegionDetail = components['schemas']['PatentMapRegionDetail'];

export default function PatentMapRegionDetailPage() {
  const regionCode = useRouteStringParam('regionCode') || '';
  const year = useRouteNumberParam('year') || 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PatentMapRegionDetail | null>(null);

  const load = useCallback(async () => {
    if (!regionCode || !year) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<PatentMapRegionDetail>(`/patent-map/regions/${regionCode}`, { year });
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [regionCode, year]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!regionCode || !year) {
    return (
      <View className="container page-bg-plain">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container page-bg-plain">
      <PageHeader title="区域详情" subtitle={`区域编码：${regionCode} · 年份：${year}`} />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface>
            <Text className="text-title">{data.regionName}</Text>
            <Spacer size={8} />
            <Space wrap align="center">
              <Tag type="default" plain round>
                年份：{data.year}
              </Tag>
              <Tag type="primary" plain round>
                专利：{data.patentCount}
              </Tag>
              {data.updatedAt ? (
                <Tag type="default" plain round>
                  更新：{formatTimeSmart(data.updatedAt)}
                </Tag>
              ) : null}
            </Space>
          </Surface>

          <Spacer size={12} />

          <SectionHeader title="产业分布" density="compact" />
          <Surface padding="none">
            <CellGroup divider>
              {data.industryBreakdown.length ? (
                data.industryBreakdown.map((it, idx) => (
                  <CellRow
                    key={`${it.industryTag}-${idx}`}
                    arrow={false}
                    title={<Text className="text-strong">{it.industryTag}</Text>}
                    extra={
                      <Tag type="primary" plain round>
                        {it.count}
                      </Tag>
                    }
                    isLast={idx === data.industryBreakdown.length - 1}
                  />
                ))
              ) : (
                <CellRow arrow={false} title={<Text className="muted">暂无数据</Text>} isLast />
              )}
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <SectionHeader title="重点单位" density="compact" />
          <Surface padding="none">
            <CellGroup divider>
              {data.topAssignees.length ? (
                data.topAssignees.map((it, idx) => (
                  <CellRow
                    key={`${it.name}-${idx}`}
                    arrow={false}
                    title={<Text className="text-strong clamp-1">{it.name}</Text>}
                    extra={
                      <Tag type="primary" plain round>
                        {it.patentCount}
                      </Tag>
                    }
                    isLast={idx === data.topAssignees.length - 1}
                  />
                ))
              ) : (
                <CellRow arrow={false} title={<Text className="muted">暂无数据</Text>} isLast />
              )}
            </CellGroup>
          </Surface>
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}

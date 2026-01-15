import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';

import type { components } from '@ipmoney/api-types';

import { apiGet } from '../../../lib/api';
import { formatTimeSmart } from '../../../lib/format';
import { patentTypeLabel } from '../../../lib/labels';
import { safeNavigateBack } from '../../../lib/navigation';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { CellRow, PageHeader, SectionHeader, Spacer, Surface, TipBanner } from '../../../ui/layout';
import { Button, CellGroup, Space, Tag, toast } from '../../../ui/nutui';
import { EmptyCard, ErrorCard, LoadingCard, MissingParamCard } from '../../../ui/StateCards';

type Patent = components['schemas']['Patent'];

function legalStatusLabel(status?: Patent['legalStatus']): string {
  if (!status) return '未知';
  if (status === 'PENDING') return '审查中';
  if (status === 'GRANTED') return '已授权';
  if (status === 'EXPIRED') return '已失效';
  if (status === 'INVALIDATED') return '已无效';
  return '未知';
}

function legalStatusTagType(status?: Patent['legalStatus']): React.ComponentProps<typeof Tag>['type'] {
  if (!status) return 'default';
  if (status === 'GRANTED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'EXPIRED' || status === 'INVALIDATED') return 'danger';
  return 'default';
}

function sourcePrimaryLabel(source?: Patent['sourcePrimary']): string {
  if (!source) return '未知';
  if (source === 'USER') return '用户上传';
  if (source === 'ADMIN') return '平台维护';
  if (source === 'PROVIDER') return '第三方数据源';
  return '未知';
}

export default function PatentDetailPage() {
  const patentId = useRouteUuidParam('patentId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Patent | null>(null);

  const load = useCallback(async () => {
    if (!patentId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Patent>(`/patents/${patentId}`);
      setData(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patentId]);

  const copyText = useCallback(async (text: string) => {
    try {
      await Taro.setClipboardData({ data: text });
      toast('已复制', { icon: 'success' });
    } catch (_) {
      toast('复制失败', { icon: 'fail' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!patentId) {
    return (
      <View className="container">
        <MissingParamCard onAction={() => void safeNavigateBack()} />
      </View>
    );
  }

  return (
    <View className="container">
      <PageHeader title="专利详情" subtitle="展示专利主数据与法律状态信息。" />
      <Spacer />

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : data ? (
        <View>
          <Surface className="detail-meta-card">
            <Text className="text-title clamp-2">{data.title || '未命名专利'}</Text>
            <Spacer size={8} />
            <Space wrap align="center">
              <Tag type="primary" plain round>
                类型：{patentTypeLabel(data.patentType)}
              </Tag>
              <Tag type={legalStatusTagType(data.legalStatus)} plain round>
                状态：{legalStatusLabel(data.legalStatus)}
              </Tag>
            </Space>
            <Spacer size={10} />
            <View className="row-between" style={{ gap: '12rpx', alignItems: 'center' }}>
              <Text className="muted ellipsis" style={{ flex: 1, minWidth: 0 }}>
                申请号：{data.applicationNoDisplay || data.applicationNoNorm || '-'}
              </Text>
              {data.applicationNoDisplay || data.applicationNoNorm ? (
                <Button
                  block={false}
                  size="small"
                  variant="ghost"
                  onClick={() => void copyText((data.applicationNoDisplay || data.applicationNoNorm) as string)}
                >
                  复制
                </Button>
              ) : null}
            </View>
          </Surface>

          <Spacer size={12} />

          <Surface>
            <SectionHeader title="摘要" density="compact" />
            <Text className="muted break-word">{data.abstract || '暂无摘要'}</Text>
          </Surface>

          <Spacer size={12} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow
                arrow={false}
                title={<Text className="text-strong">发明人</Text>}
                description={<Text className="muted break-word">{data.inventorNames?.length ? data.inventorNames.join(' / ') : '暂无'}</Text>}
              />
              <CellRow
                arrow={false}
                title={<Text className="text-strong">专利权人</Text>}
                description={<Text className="muted break-word">{data.assigneeNames?.length ? data.assigneeNames.join(' / ') : '暂无'}</Text>}
              />
              <CellRow
                arrow={false}
                title={<Text className="text-strong">申请人</Text>}
                description={<Text className="muted break-word">{data.applicantNames?.length ? data.applicantNames.join(' / ') : '暂无'}</Text>}
                isLast
              />
            </CellGroup>
          </Surface>

          <Spacer size={12} />

          <Surface padding="none">
            <CellGroup divider>
              <CellRow arrow={false} title={<Text className="text-strong">申请日</Text>} extra={<Text className="muted">{data.filingDate || '-'}</Text>} />
              <CellRow arrow={false} title={<Text className="text-strong">公开日</Text>} extra={<Text className="muted">{data.publicationDate || '-'}</Text>} />
              <CellRow arrow={false} title={<Text className="text-strong">授权日</Text>} extra={<Text className="muted">{data.grantDate || '-'}</Text>} isLast />
            </CellGroup>
          </Surface>

          {data.sourcePrimary || data.sourceUpdatedAt ? (
            <>
              <Spacer size={12} />
              <TipBanner tone="info" title="数据来源">
                {`来源：${sourcePrimaryLabel(data.sourcePrimary)}${data.sourceUpdatedAt ? ` · 更新：${formatTimeSmart(data.sourceUpdatedAt)}` : ''}`}
              </TipBanner>
            </>
          ) : null}
        </View>
      ) : (
        <EmptyCard message="无数据" actionText="返回" onAction={() => void safeNavigateBack()} />
      )}
    </View>
  );
}

import { Button, Card, Input, InputNumber, Select, Space, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPut } from '../lib/api';

type PatentMapIndustryCount = { industryTag: string; patentCount: number };
type PatentMapTopAssignee = { assigneeName: string; patentCount: number };

type PatentMapEntry = {
  regionCode: string;
  year: number;
  patentCount: number;
  industryBreakdown: PatentMapIndustryCount[];
  topAssignees: PatentMapTopAssignee[];
  createdAt?: string;
  updatedAt?: string;
};

function safeParseJsonArray<T>(text: string): T[] | undefined {
  const v = text.trim();
  if (!v) return undefined;
  const parsed = JSON.parse(v);
  if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组');
  return parsed as T[];
}

export function PatentMapPage() {
  const [years, setYears] = useState<number[]>([]);
  const [regionCode, setRegionCode] = useState('110000');
  const [year, setYear] = useState<number>(2025);

  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<PatentMapEntry | null>(null);

  const [patentCount, setPatentCount] = useState<number>(0);
  const [industryJson, setIndustryJson] = useState('');
  const [assigneesJson, setAssigneesJson] = useState('');

  const loadYears = useCallback(async () => {
    try {
      const d = await apiGet<number[]>('/patent-map/years');
      setYears(d);
      if (d.length && !d.includes(year)) setYear(d[0]);
    } catch (e: any) {
      message.error(e?.message || '加载年份失败');
    }
  }, [year]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  const loadEntry = useCallback(async () => {
    if (!regionCode || !year) return;
    setLoading(true);
    try {
      const d = await apiGet<PatentMapEntry>(
        `/admin/patent-map/regions/${regionCode}/years/${year}`,
      );
      setEntry(d);
      setPatentCount(d.patentCount);
      setIndustryJson(JSON.stringify(d.industryBreakdown || [], null, 2));
      setAssigneesJson(JSON.stringify(d.topAssignees || [], null, 2));
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('404')) {
        setEntry(null);
        setPatentCount(0);
        setIndustryJson('[]');
        setAssigneesJson('[]');
        message.info('暂无数据：可直接录入并保存（演示）');
      } else {
        message.error(e?.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [regionCode, year]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  const canSave = useMemo(() => Boolean(regionCode && year), [regionCode, year]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            专利地图 CMS（演示）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            P0 数据来源：用户上传/后台录入；本页用于录入区域专利数量与产业/重点单位结构。
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Input
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            style={{ width: 180 }}
            placeholder="地区编码（6 位）"
          />
          <Select
            value={year}
            style={{ width: 140 }}
            options={(years.length ? years : [year]).map((y) => ({ value: y, label: String(y) }))}
            onChange={(v) => setYear(v)}
          />
          <Button loading={loading} onClick={loadEntry}>
            加载
          </Button>
          <Button
            onClick={() => {
              void loadYears();
            }}
          >
            刷新年份
          </Button>
        </Space>

        <Card size="small" style={{ background: '#fff7ed' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text strong>录入/更新（regionCode + year）</Typography.Text>

            <Space wrap>
              <Typography.Text>专利数量</Typography.Text>
              <InputNumber
                value={patentCount}
                min={0}
                onChange={(v) => setPatentCount(Number(v || 0))}
              />
              <Button
                type="primary"
                disabled={!canSave}
                onClick={async () => {
                  try {
                    const payload = {
                      patentCount,
                      industryBreakdown: safeParseJsonArray<PatentMapIndustryCount>(industryJson),
                      topAssignees: safeParseJsonArray<PatentMapTopAssignee>(assigneesJson),
                    };
                    const next = await apiPut<PatentMapEntry>(
                      `/admin/patent-map/regions/${regionCode}/years/${year}`,
                      payload,
                      { idempotencyKey: `demo-patent-map-${regionCode}-${year}` },
                    );
                    message.success('已保存');
                    setEntry(next);
                  } catch (e: any) {
                    message.error(e?.message || '保存失败');
                  }
                }}
              >
                保存
              </Button>
            </Space>

            <Typography.Text type="secondary">
              产业分布（JSON 数组，每项：{`{ industryTag, patentCount }`})
            </Typography.Text>
            <Input.TextArea
              value={industryJson}
              onChange={(e) => setIndustryJson(e.target.value)}
              rows={6}
            />

            <Typography.Text type="secondary">
              重点单位（JSON 数组，每项：{`{ assigneeName, patentCount }`})
            </Typography.Text>
            <Input.TextArea
              value={assigneesJson}
              onChange={(e) => setAssigneesJson(e.target.value)}
              rows={6}
            />
          </Space>
        </Card>

        <Typography.Text type="secondary">
          当前数据：{entry ? `patentCount=${entry.patentCount}` : '（未加载/暂无）'}
        </Typography.Text>
      </Space>
    </Card>
  );
}

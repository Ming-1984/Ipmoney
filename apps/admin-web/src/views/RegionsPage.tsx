import { Button, Card, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPatch, apiPost, apiPut } from '../lib/api';
import { RequestErrorAlert } from '../ui/RequestState';

type RegionLevel = 'PROVINCE' | 'CITY' | 'DISTRICT';

type RegionNode = {
  code: string;
  name: string;
  level: RegionLevel;
  parentCode?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  industryTags?: string[];
  updatedAt?: string;
};

type IndustryTag = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

function levelLabel(level: RegionLevel): string {
  if (level === 'PROVINCE') return '省级';
  if (level === 'CITY') return '市级';
  return '区县';
}

export function RegionsPage() {
  const [tab, setTab] = useState<'regions' | 'tags'>('regions');

  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tags, setTags] = useState<IndustryTag[]>([]);

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    setTagsError(null);
    try {
      const d = await apiGet<IndustryTag[]>('/admin/industry-tags');
      setTags(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setTagsError(e?.message || '加载失败');
      setTags([]);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const tagOptions = useMemo(() => tags.map((t) => ({ value: t.name, label: t.name })), [tags]);

  const createTag = useCallback(() => {
    let value = '';
    Modal.confirm({
      title: '新增产业标签',
      content: (
        <Input
          placeholder="输入标签名称（例：新能源）"
          onChange={(e) => {
            value = e.target.value;
          }}
        />
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        const name = value.trim();
        if (!name) {
          message.error('请输入名称');
          return;
        }
        try {
          await apiPost<IndustryTag>('/admin/industry-tags', { name });
          message.success('已创建');
          void loadTags();
        } catch (e: any) {
          message.error(e?.message || '创建失败');
        }
      },
    });
  }, [loadTags]);

  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionNode[]>([]);

  const [level, setLevel] = useState<RegionLevel | ''>('');
  const [parentCode, setParentCode] = useState('');
  const [q, setQ] = useState('');

  const loadRegions = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const d = await apiGet<RegionNode[]>('/admin/regions', {
        ...(level ? { level } : {}),
        ...(parentCode.trim() ? { parentCode: parentCode.trim() } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
      setRegions(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setRegionsError(e?.message || '加载失败');
      setRegions([]);
    } finally {
      setRegionsLoading(false);
    }
  }, [level, parentCode, q]);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [regionModalMode, setRegionModalMode] = useState<'create' | 'edit'>('create');
  const [regionForm, setRegionForm] = useState<{
    code: string;
    name: string;
    level: RegionLevel;
    parentCode: string;
    centerLat: number | null;
    centerLng: number | null;
  }>({ code: '', name: '', level: 'PROVINCE', parentCode: '', centerLat: null, centerLng: null });

  const openCreateRegion = useCallback(() => {
    setRegionModalMode('create');
    setRegionForm({ code: '', name: '', level: 'PROVINCE', parentCode: '', centerLat: null, centerLng: null });
    setRegionModalOpen(true);
  }, []);

  const openEditRegion = useCallback((r: RegionNode) => {
    setRegionModalMode('edit');
    setRegionForm({
      code: r.code,
      name: r.name,
      level: r.level,
      parentCode: String(r.parentCode || ''),
      centerLat: r.centerLat ?? null,
      centerLng: r.centerLng ?? null,
    });
    setRegionModalOpen(true);
  }, []);

  const submitRegion = useCallback(async () => {
    const payload: any = {
      name: regionForm.name.trim(),
      level: regionForm.level,
      parentCode: regionForm.parentCode.trim() ? regionForm.parentCode.trim() : null,
      centerLat: regionForm.centerLat,
      centerLng: regionForm.centerLng,
    };
    if (!payload.name) {
      message.error('请填写名称');
      return;
    }

    try {
      if (regionModalMode === 'create') {
        const code = regionForm.code.trim();
        if (!/^[0-9]{6}$/.test(code)) {
          message.error('区域 code 必须为 6 位数字（adcode）');
          return;
        }
        await apiPost<RegionNode>('/admin/regions', { code, ...payload });
        message.success('已创建');
      } else {
        await apiPatch<RegionNode>(`/admin/regions/${regionForm.code}`, payload);
        message.success('已更新');
      }
      setRegionModalOpen(false);
      void loadRegions();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  }, [loadRegions, regionForm, regionModalMode]);

  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [tagsRegionCode, setTagsRegionCode] = useState<string>('');
  const [tagsSelected, setTagsSelected] = useState<string[]>([]);

  const openSetTags = useCallback((r: RegionNode) => {
    setTagsRegionCode(r.code);
    setTagsSelected(Array.isArray(r.industryTags) ? r.industryTags : []);
    setTagsModalOpen(true);
  }, []);

  const saveTags = useCallback(async () => {
    if (!tagsRegionCode) return;
    try {
      await apiPut<RegionNode>(
        `/admin/regions/${tagsRegionCode}/industry-tags`,
        { industryTags: tagsSelected },
        { idempotencyKey: `region-tags-${tagsRegionCode}` },
      );
      message.success('已保存');
      setTagsModalOpen(false);
      void loadRegions();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  }, [loadRegions, tagsRegionCode, tagsSelected]);

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            区域与产业标签（运营配置）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            用于地域特色推荐与搜索加权：区域（adcode）与产业标签均可后台维护。
          </Typography.Paragraph>
        </div>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          items={[
            {
              key: 'regions',
              label: '区域管理',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {regionsError ? <RequestErrorAlert error={regionsError} onRetry={loadRegions} /> : null}

                  <Space wrap>
                    <Select
                      value={level}
                      placeholder="层级"
                      style={{ width: 140 }}
                      options={[
                        { value: '', label: '全部层级' },
                        { value: 'PROVINCE', label: '省' },
                        { value: 'CITY', label: '市' },
                        { value: 'DISTRICT', label: '区县' },
                      ]}
                      onChange={(v) => setLevel(v as any)}
                    />
                    <Input
                      value={parentCode}
                      placeholder="parentCode（可选）"
                      style={{ width: 180 }}
                      onChange={(e) => setParentCode(e.target.value)}
                    />
                    <Input
                      value={q}
                      placeholder="名称/拼音关键字（可选）"
                      style={{ width: 240 }}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <Button loading={regionsLoading} onClick={() => void loadRegions()}>
                      查询
                    </Button>
                    <Button type="primary" onClick={openCreateRegion}>
                      新增区域
                    </Button>
                  </Space>

                  <Table<RegionNode>
                    rowKey="code"
                    loading={regionsLoading}
                    dataSource={regions}
                    pagination={false}
                    columns={[
                      { title: 'code', dataIndex: 'code', width: 120 },
                      { title: '名称', dataIndex: 'name' },
                      { title: '层级', dataIndex: 'level', render: (v) => levelLabel(v as RegionLevel), width: 120 },
                      { title: 'parentCode', dataIndex: 'parentCode', width: 120 },
                      {
                        title: '产业标签',
                        dataIndex: 'industryTags',
                        render: (v) => (Array.isArray(v) && v.length ? v.join(', ') : '-'),
                      },
                      {
                        title: '操作',
                        key: 'actions',
                        width: 220,
                        render: (_, r) => (
                          <Space>
                            <Button onClick={() => openEditRegion(r)}>编辑</Button>
                            <Button onClick={() => openSetTags(r)}>设置标签</Button>
                          </Space>
                        ),
                      },
                    ]}
                  />

                  <Modal
                    open={regionModalOpen}
                    title={regionModalMode === 'create' ? '新增区域' : '编辑区域'}
                    okText="保存"
                    cancelText="取消"
                    onCancel={() => setRegionModalOpen(false)}
                    onOk={() => void submitRegion()}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Input
                        value={regionForm.code}
                        disabled={regionModalMode === 'edit'}
                        placeholder="code（6 位 adcode，如 110000）"
                        onChange={(e) => setRegionForm((p) => ({ ...p, code: e.target.value }))}
                      />
                      <Input
                        value={regionForm.name}
                        placeholder="名称"
                        onChange={(e) => setRegionForm((p) => ({ ...p, name: e.target.value }))}
                      />
                      <Select
                        value={regionForm.level}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'PROVINCE', label: '省' },
                          { value: 'CITY', label: '市' },
                          { value: 'DISTRICT', label: '区县' },
                        ]}
                        onChange={(v) => setRegionForm((p) => ({ ...p, level: v as RegionLevel }))}
                      />
                      <Input
                        value={regionForm.parentCode}
                        placeholder="parentCode（可选）"
                        onChange={(e) => setRegionForm((p) => ({ ...p, parentCode: e.target.value }))}
                      />
                      <Space>
                        <span>中心点</span>
                        <InputNumber
                          value={regionForm.centerLng ?? undefined}
                          placeholder="lng"
                          onChange={(v) => setRegionForm((p) => ({ ...p, centerLng: v === null ? null : Number(v) }))}
                        />
                        <InputNumber
                          value={regionForm.centerLat ?? undefined}
                          placeholder="lat"
                          onChange={(v) => setRegionForm((p) => ({ ...p, centerLat: v === null ? null : Number(v) }))}
                        />
                      </Space>
                    </Space>
                  </Modal>

                  <Modal
                    open={tagsModalOpen}
                    title={`设置产业标签：${tagsRegionCode}`}
                    okText="保存"
                    cancelText="取消"
                    onCancel={() => setTagsModalOpen(false)}
                    onOk={() => void saveTags()}
                  >
                    <Typography.Paragraph type="secondary">
                      建议从“产业标签”列表中选择；也可手动输入（将按字符串保存）。
                    </Typography.Paragraph>
                    <Select
                      mode="multiple"
                      value={tagsSelected}
                      style={{ width: '100%' }}
                      placeholder="选择产业标签"
                      options={tagOptions}
                      onChange={(v) => setTagsSelected(v as string[])}
                    />
                  </Modal>
                </Space>
              ),
            },
            {
              key: 'tags',
              label: '产业标签',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {tagsError ? <RequestErrorAlert error={tagsError} onRetry={loadTags} /> : null}

                  <Space>
                    <Button onClick={createTag} type="primary">
                      新增标签
                    </Button>
                    <Button loading={tagsLoading} onClick={() => void loadTags()}>
                      刷新
                    </Button>
                  </Space>

                  <Table<IndustryTag>
                    rowKey="id"
                    loading={tagsLoading}
                    dataSource={tags}
                    pagination={false}
                    columns={[
                      { title: 'name', dataIndex: 'name' },
                      { title: 'id', dataIndex: 'id', width: 260 },
                      { title: 'createdAt', dataIndex: 'createdAt', width: 200 },
                    ]}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}


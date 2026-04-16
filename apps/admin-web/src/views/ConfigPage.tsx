import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiGet, apiPut, apiUploadFile, type FileObject } from '../lib/api';
import { fenToYuanNumber, yuanToFen } from '../lib/format';
import { confirmActionWithReason } from '../ui/confirm';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';

type TradeRulesConfig = {
  version: number;
  depositRate: number;
  depositMinFen: number;
  depositMaxFen: number;
  depositFixedForNegotiableFen: number;
  autoRefundWindowMinutes: number;
  sellerMaterialDeadlineBusinessDays: number;
  contractSignedDeadlineBusinessDays: number;
  transferCompletedSlaDays: number;
  commissionRate: number;
  commissionMinFen: number;
  commissionMaxFen: number;
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED';
  payoutMethodDefault: 'MANUAL' | 'WECHAT';
  autoPayoutOnTimeout: boolean;
};

type RecommendationConfig = {
  enabled: boolean;
  timeDecayHalfLifeHours: number;
  dedupeWindowHours: number;
  weights: {
    time: number;
    view: number;
    favorite: number;
    consult: number;
    region: number;
    user: number;
  };
  featuredBoost: { province: number; city: number };
  updatedAt?: string;
};

type BannerMediaType = 'IMAGE' | 'VIDEO';

type BannerVideoMeta = {
  durationMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
};

type BannerConfig = {
  items: {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    enabled: boolean;
    order: number;
    mediaType?: BannerMediaType;
    videoUrl?: string;
    posterUrl?: string;
    videoMeta?: BannerVideoMeta;
  }[];
};

type CustomerServiceConfig = {
  phone: string;
  defaultReply: string;
  assignStrategy: 'AUTO' | 'MANUAL';
};

type TaxonomyConfig = {
  industries: string[];
  ipcMappings: string[];
  locMappings: string[];
};

type SensitiveWordsConfig = {
  words: string[];
};

type HotSearchConfig = {
  keywords: string[];
};

type AlertRule = {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  channels: Array<'SMS' | 'EMAIL' | 'IN_APP'>;
  enabled: boolean;
  threshold?: number;
  cooldownMinutes?: number;
};

type AlertConfig = {
  enabled: boolean;
  defaultChannels?: Array<'SMS' | 'EMAIL' | 'IN_APP'>;
  rules: AlertRule[];
};

type HomeLandingConfig = Record<string, unknown>;

function toList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tradeForm] = Form.useForm();
  const [recForm] = Form.useForm();
  const [bannerJson, setBannerJson] = useState('');
  const [bannerVideoFile, setBannerVideoFile] = useState<FileObject | null>(null);
  const [bannerPosterFile, setBannerPosterFile] = useState<FileObject | null>(null);
  const [csPhone, setCsPhone] = useState('');
  const [csDefaultReply, setCsDefaultReply] = useState('');
  const [csAssignStrategy, setCsAssignStrategy] = useState<CustomerServiceConfig['assignStrategy']>('AUTO');
  const [taxonomyIndustries, setTaxonomyIndustries] = useState('');
  const [taxonomyIpc, setTaxonomyIpc] = useState('');
  const [taxonomyLoc, setTaxonomyLoc] = useState('');
  const [sensitiveWords, setSensitiveWords] = useState('');
  const [hotSearchKeywords, setHotSearchKeywords] = useState('');
  const [alertJson, setAlertJson] = useState('');
  const [homeLandingJson, setHomeLandingJson] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trade = await apiGet<TradeRulesConfig>('/admin/config/trade-rules');
      tradeForm.setFieldsValue({
        ...trade,
        depositMinYuan: fenToYuanNumber(trade.depositMinFen),
        depositMaxYuan: fenToYuanNumber(trade.depositMaxFen),
        depositFixedForNegotiableYuan: fenToYuanNumber(trade.depositFixedForNegotiableFen),
        commissionMinYuan: fenToYuanNumber(trade.commissionMinFen),
        commissionMaxYuan: fenToYuanNumber(trade.commissionMaxFen),
      });

      const rec = await apiGet<RecommendationConfig>('/admin/config/recommendation');
      recForm.setFieldsValue(rec);

      const [banner, cs, taxonomy, sensitive, hotSearch, alert, homeLanding] = await Promise.all([
        apiGet<BannerConfig>('/admin/config/banner'),
        apiGet<CustomerServiceConfig>('/admin/config/customer-service'),
        apiGet<TaxonomyConfig>('/admin/config/taxonomy'),
        apiGet<SensitiveWordsConfig>('/admin/config/sensitive-words'),
        apiGet<HotSearchConfig>('/admin/config/hot-search'),
        apiGet<AlertConfig>('/admin/config/alerts'),
        apiGet<HomeLandingConfig>('/admin/config/home-landing'),
      ]);

      setBannerJson(JSON.stringify(banner, null, 2));
      setCsPhone(cs.phone || '');
      setCsDefaultReply(cs.defaultReply || '');
      setCsAssignStrategy(cs.assignStrategy || 'AUTO');
      setTaxonomyIndustries((taxonomy.industries || []).join('，'));
      setTaxonomyIpc((taxonomy.ipcMappings || []).join('，'));
      setTaxonomyLoc((taxonomy.locMappings || []).join('，'));
      setSensitiveWords((sensitive.words || []).join('，'));
      setHotSearchKeywords((hotSearch.keywords || []).join('，'));
      setAlertJson(JSON.stringify(alert, null, 2));
      setHomeLandingJson(JSON.stringify(homeLanding, null, 2));
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [recForm, tradeForm]);

  useEffect(() => {
    void load();
  }, [load]);


  const parseBannerJson = useCallback(() => {
    try {
      return JSON.parse(bannerJson) as BannerConfig;
    } catch (e: any) {
      message.error(e?.message || '\u4fdd\u5b58\u5931\u8d25\uff0c\u68c0\u67e5 JSON \u683c\u5f0f');
      return null;
    }
  }, [bannerJson]);

  const normalizeBannerConfig = useCallback((input: BannerConfig | null) => {
    const base: BannerConfig = input && typeof input === 'object' ? input : { items: [] };
    const items = Array.isArray(base.items) ? [...base.items] : [];
    if (!items.length) {
      items.push({
        id: `banner-${Date.now()}`,
        title: '\u9996\u9875\u89c6\u9891',
        imageUrl: '',
        linkUrl: '',
        enabled: true,
        order: 1,
        mediaType: 'VIDEO',
      });
    }
    const first = { ...items[0] };
    items[0] = first;
    return { ...base, items };
  }, []);

  const updateBannerJson = useCallback(
    (updater: (config: BannerConfig) => BannerConfig) => {
      const parsed = parseBannerJson();
      if (!parsed) return;
      const normalized = normalizeBannerConfig(parsed);
      const next = updater(normalized);
      setBannerJson(JSON.stringify(next, null, 2));
    },
    [normalizeBannerConfig, parseBannerJson],
  );

  const applyBannerUpload = useCallback(
    (kind: 'video' | 'poster', url: string) => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const current = { ...items[0] };
        current.mediaType = 'VIDEO';
        current.enabled = current.enabled !== false;
        current.order = Number.isFinite(current.order) ? current.order : 1;
        if (kind === 'video') {
          current.videoUrl = url;
        } else {
          current.posterUrl = url;
          current.imageUrl = url;
        }
        items[0] = current;
        return { ...config, items };
      });
    },
    [updateBannerJson],
  );

  const validateFileSize = useCallback((file: File, maxMb: number) => {
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > maxMb) {
      message.error(`\u6587\u4ef6\u8fc7\u5927\uff0c\u9700\u5c0f\u4e8e ${maxMb}MB`);
      return false;
    }
    return true;
  }, []);

  const bannerConfigDraft = useMemo(() => {
    try {
      return JSON.parse(bannerJson) as BannerConfig;
    } catch {
      return null;
    }
  }, [bannerJson]);

  const bannerItemsView = useMemo(() => {
    const normalized = normalizeBannerConfig(bannerConfigDraft);
    return [...normalized.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [bannerConfigDraft, normalizeBannerConfig]);

  const updateBannerItem = useCallback(
    (id: string, patch: Partial<BannerConfig['items'][number]>) => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const idx = items.findIndex((item) => item.id === id);
        if (idx < 0) return config;
        items[idx] = { ...items[idx], ...patch };
        return { ...config, items };
      });
    },
    [updateBannerJson],
  );

  const moveBannerItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      updateBannerJson((config) => {
        const items = [...config.items];
        const idx = items.findIndex((item) => item.id === id);
        if (idx < 0) return config;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= items.length) return config;
        const next = [...items];
        const currentOrder = Number.isFinite(next[idx].order) ? next[idx].order : idx + 1;
        const targetOrder = Number.isFinite(next[target].order) ? next[target].order : target + 1;
        [next[idx], next[target]] = [next[target], next[idx]];
        next[idx].order = targetOrder;
        next[target].order = currentOrder;
        return { ...config, items: next };
      });
    },
    [updateBannerJson],
  );

  return (
    <Space className="admin-config-page" direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          交易规则配置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          默认：卖家承担佣金；尾款在线上托管支付；放款默认人工确认。
        </Typography.Paragraph>

        <Form form={tradeForm} layout="vertical">
          <Space wrap size={16}>
            <Form.Item label="订金比例（0-1）" name="depositRate" style={{ width: 220 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="订金最小值（元）" name="depositMinYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="订金最大值（元）" name="depositMaxYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="面议订金固定值（元）"
              name="depositFixedForNegotiableYuan"
              style={{ width: 220 }}
            >
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space wrap size={16}>
            <Form.Item
              label="自动退款窗口（分钟）"
              name="autoRefundWindowMinutes"
              style={{ width: 220 }}
            >
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="卖家补材料时限（工作日）"
              name="sellerMaterialDeadlineBusinessDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="合同签署时限（工作日）"
              name="contractSignedDeadlineBusinessDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="变更 SLA（天）"
              name="transferCompletedSlaDays"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space wrap size={16}>
            <Form.Item label="佣金比例（0-1）" name="commissionRate" style={{ width: 220 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="佣金最小值（元）" name="commissionMinYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="佣金最大值（元）" name="commissionMaxYuan" style={{ width: 220 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="允许超时自动放款"
              name="autoPayoutOnTimeout"
              valuePropName="checked"
              style={{ width: 220 }}
            >
              <Switch />
            </Form.Item>
          </Space>

          <Button
            type="primary"
            onClick={async () => {
              const v = tradeForm.getFieldsValue(true);
              const { ok } = await confirmActionWithReason({
                title: '确认保存交易规则？',
                content: '该操作会影响订金/佣金/退款窗口等关键参数；建议填写变更原因并留痕。',
                okText: '保存',
                reasonLabel: '变更原因（必填）',
                reasonPlaceholder: '例：按合同口径调整订金比例；运营阶段策略变更；法务要求等。',
                reasonRequired: true,
              });
              if (!ok) return;
              const payload = {
                depositRate: v.depositRate,
                depositMinFen: yuanToFen(v.depositMinYuan),
                depositMaxFen: yuanToFen(v.depositMaxYuan),
                depositFixedForNegotiableFen: yuanToFen(v.depositFixedForNegotiableYuan),
                autoRefundWindowMinutes: v.autoRefundWindowMinutes,
                sellerMaterialDeadlineBusinessDays: v.sellerMaterialDeadlineBusinessDays,
                contractSignedDeadlineBusinessDays: v.contractSignedDeadlineBusinessDays,
                transferCompletedSlaDays: v.transferCompletedSlaDays,
                commissionRate: v.commissionRate,
                commissionMinFen: yuanToFen(v.commissionMinYuan),
                commissionMaxFen: yuanToFen(v.commissionMaxYuan),
                payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED',
                payoutMethodDefault: 'MANUAL',
                autoPayoutOnTimeout: Boolean(v.autoPayoutOnTimeout),
              };
              try {
                await apiPut<TradeRulesConfig>('/admin/config/trade-rules', payload);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存交易规则
          </Button>
        </Form>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {'Banner \u914d\u7f6e'}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {'\u7ef4\u62a4\u9996\u9875\u8f6e\u64ad\u56fe\uff08\u5efa\u8bae JSON \u7f16\u8f91\uff1b\u4fdd\u5b58\u524d\u8bf7\u786e\u4fdd\u683c\u5f0f\u6b63\u786e\uff09\u3002'}
        </Typography.Paragraph>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap size={12}>
            <Upload
              maxCount={1}
              showUploadList={false}
              accept="video/*"
              beforeUpload={(file) => (validateFileSize(file as File, 30) ? true : Upload.LIST_IGNORE)}
              customRequest={async (options: any) => {
                try {
                  const uploaded = await apiUploadFile(options.file as File, 'BANNER_VIDEO');
                  setBannerVideoFile(uploaded);
                  applyBannerUpload('video', uploaded.url);
                  message.success('\u89c6\u9891\u5df2\u4e0a\u4f20\u5e76\u5199\u5165 Banner \u914d\u7f6e');
                  options.onSuccess?.(uploaded);
                } catch (e: any) {
                  options.onError?.(e);
                  message.error(e?.message || '\u89c6\u9891\u4e0a\u4f20\u5931\u8d25');
                }
              }}
            >
              <Button>{'\u4e0a\u4f20\u89c6\u9891'}</Button>
            </Upload>
            <Upload
              maxCount={1}
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => (validateFileSize(file as File, 10) ? true : Upload.LIST_IGNORE)}
              customRequest={async (options: any) => {
                try {
                  const uploaded = await apiUploadFile(options.file as File, 'BANNER_POSTER');
                  setBannerPosterFile(uploaded);
                  applyBannerUpload('poster', uploaded.url);
                  message.success('\u5c01\u9762\u5df2\u4e0a\u4f20\u5e76\u5199\u5165 Banner \u914d\u7f6e');
                  options.onSuccess?.(uploaded);
                } catch (e: any) {
                  options.onError?.(e);
                  message.error(e?.message || '\u5c01\u9762\u4e0a\u4f20\u5931\u8d25');
                }
              }}
            >
              <Button>{'\u4e0a\u4f20\u5c01\u9762'}</Button>
            </Upload>
          </Space>
          <Typography.Text type="secondary">
            {'\u4e0a\u4f20\u4f1a\u5199\u5165 Banner JSON\uff1b\u5982\u9700\u516c\u7f51 CDN \u76f4\u94fe\uff0c\u8bf7\u5728 JSON \u4e2d\u66ff\u6362 videoUrl/posterUrl\u3002'}
          </Typography.Text>
          {bannerVideoFile ? (
            <Typography.Text type="secondary">{`\u89c6\u9891\u6587\u4ef6\uff1a${bannerVideoFile.url}`}</Typography.Text>
          ) : null}
          {bannerPosterFile ? (
            <Typography.Text type="secondary">{`\u5c01\u9762\u6587\u4ef6\uff1a${bannerPosterFile.url}`}</Typography.Text>
          ) : null}
        </Space>

        {bannerConfigDraft ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {bannerItemsView.map((item, idx) => (
              <Card key={item.id} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap size={12} align="center">
                    <Input
                      value={item.title}
                      onChange={(e) => updateBannerItem(item.id, { title: e.target.value })}
                      placeholder={`\u6807\u9898`} 
                      style={{ width: 220 }}
                    />
                    <Switch
                      checked={item.enabled !== false}
                      onChange={(checked) => updateBannerItem(item.id, { enabled: checked })}
                      checkedChildren={`\u4e0a\u67b6`} 
                      unCheckedChildren={`\u4e0b\u67b6`} 
                    />
                    <InputNumber
                      min={0}
                      value={item.order}
                      onChange={(val) => updateBannerItem(item.id, { order: typeof val === 'number' ? val : 0 })}
                    />
                    <Button disabled={idx === 0} onClick={() => moveBannerItem(item.id, 'up')}>
                      {'\u4e0a\u79fb'}
                    </Button>
                    <Button
                      disabled={idx === bannerItemsView.length - 1}
                      onClick={() => moveBannerItem(item.id, 'down')}
                    >
                      {'\u4e0b\u79fb'}
                    </Button>
                  </Space>
                  <Typography.Text type="secondary">
                    {`\u89c6\u9891\u94fe\u63a5\uff1a${item.videoUrl || '-'}`}
                  </Typography.Text>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      {'封面（可上传或粘贴 URL）'}
                    </Typography.Text>
                    <ImageUrlUploadField
                      value={item.posterUrl || item.imageUrl || ''}
                      uploadPurpose="BANNER_POSTER"
                      maxSizeMb={10}
                      onChange={(next) => {
                        updateBannerItem(item.id, { posterUrl: next, imageUrl: next });
                      }}
                    />
                  </Space>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Typography.Text type="danger">
            {'\u65e0\u6cd5\u89e3\u6790 Banner JSON\uff0c\u8bf7\u5148\u4fee\u6b63\u683c\u5f0f\u3002'}
          </Typography.Text>
        )}
        <Input.TextArea
          value={bannerJson}
          onChange={(e) => setBannerJson(e.target.value)}
          rows={8}
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '\u786e\u8ba4\u4fdd\u5b58 Banner \u914d\u7f6e\uff1f',
                content: '\u4fdd\u5b58\u540e\u5c06\u5f71\u54cd\u9996\u9875\u8f6e\u64ad\u56fe\u5c55\u793a\u3002',
                okText: '\u4fdd\u5b58',
                reasonLabel: '\u53d8\u66f4\u539f\u56e0\uff08\u5efa\u8bae\u586b\u5199\uff09',
              });
              if (!ok) return;
              try {
                const payload = JSON.parse(bannerJson) as BannerConfig;
                await apiPut<BannerConfig>('/admin/config/banner', payload);
                message.success('\u4fdd\u5b58');
                void load();
              } catch (e: any) {
                message.error(e?.message || '\u4fdd\u5b58\u5931\u8d25\uff0c\u68c0\u67e5 JSON \u683c\u5f0f');
              }
            }}
          >
            {'\u4fdd\u5b58 Banner'}
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          首页运营配置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          已升级为可视化编辑（上传图片、内置图选择、卡片排序、标签联动）。建议在专用页面维护，避免直接改 JSON。
        </Typography.Paragraph>
        <Space style={{ marginTop: 8 }}>
          <Button type="primary" onClick={() => navigate('/config/home-landing')}>
            打开可视化运营配置页
          </Button>
          <Button onClick={() => setHomeLandingJson('')} disabled>
            JSON 直改已下线
          </Button>
        </Space>
      </Card>


      


      

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          客服设置
        </Typography.Title>
        <Space wrap size={16}>
          <Input
            value={csPhone}
            onChange={(e) => setCsPhone(e.target.value)}
            style={{ width: 220 }}
            placeholder="客服电话"
          />
          <Select
            value={csAssignStrategy}
            style={{ width: 180 }}
            options={[
              { value: 'AUTO', label: '自动分配' },
              { value: 'MANUAL', label: '手动分配' },
            ]}
            onChange={(v) => setCsAssignStrategy(v as CustomerServiceConfig['assignStrategy'])}
          />
        </Space>
        <Input.TextArea
          value={csDefaultReply}
          onChange={(e) => setCsDefaultReply(e.target.value)}
          rows={3}
          style={{ marginTop: 12 }}
          placeholder="默认自动回复语"
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '确认保存客服设置？',
                content: '保存后将影响前端客服展示与默认回复。',
                okText: '保存',
                reasonLabel: '变更原因（建议填写）',
              });
              if (!ok) return;
              try {
                await apiPut<CustomerServiceConfig>('/admin/config/customer-service', {
                  phone: csPhone,
                  defaultReply: csDefaultReply,
                  assignStrategy: csAssignStrategy,
                });
                message.success('已保存');
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存客服设置
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          类目与标签
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          使用逗号或换行分隔；保存后用于筛选与展示。
        </Typography.Paragraph>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            value={taxonomyIndustries}
            onChange={(e) => setTaxonomyIndustries(e.target.value)}
            rows={2}
            placeholder="行业领域"
          />
          <Input.TextArea
            value={taxonomyIpc}
            onChange={(e) => setTaxonomyIpc(e.target.value)}
            rows={2}
            placeholder="IPC 分类映射"
          />
          <Input.TextArea
            value={taxonomyLoc}
            onChange={(e) => setTaxonomyLoc(e.target.value)}
            rows={2}
            placeholder="LOC 分类映射"
          />
        </Space>
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '确认保存类目与标签？',
                content: '保存后将影响发布与筛选选项。',
                okText: '保存',
                reasonLabel: '变更原因（建议填写）',
              });
              if (!ok) return;
              try {
                await apiPut<TaxonomyConfig>('/admin/config/taxonomy', {
                  industries: toList(taxonomyIndustries),
                  ipcMappings: toList(taxonomyIpc),
                  locMappings: toList(taxonomyLoc),
                });
                message.success('已保存');
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存类目与标签
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          敏感词库
        </Typography.Title>
        <Input.TextArea
          value={sensitiveWords}
          onChange={(e) => setSensitiveWords(e.target.value)}
          rows={3}
          placeholder="敏感词（逗号或换行分隔）"
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '确认保存敏感词？',
                content: '保存后将用于审核与过滤。',
                okText: '保存',
                reasonLabel: '变更原因（建议填写）',
              });
              if (!ok) return;
              try {
                await apiPut<SensitiveWordsConfig>('/admin/config/sensitive-words', {
                  words: toList(sensitiveWords),
                });
                message.success('已保存');
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存敏感词
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          热门搜索词
        </Typography.Title>
        <Input.TextArea
          value={hotSearchKeywords}
          onChange={(e) => setHotSearchKeywords(e.target.value)}
          rows={3}
          placeholder="热门搜索词（逗号或换行分隔）"
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '确认保存热门搜索词？',
                content: '保存后将用于前端搜索推荐。',
                okText: '保存',
                reasonLabel: '变更原因（建议填写）',
              });
              if (!ok) return;
              try {
                await apiPut<HotSearchConfig>('/admin/config/hot-search', {
                  keywords: toList(hotSearchKeywords),
                });
                message.success('已保存');
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存热门搜索词
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          告警配置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          建议使用 JSON 编辑，保存前请确保格式正确；变更需留痕。
        </Typography.Paragraph>
        <Input.TextArea
          value={alertJson}
          onChange={(e) => setAlertJson(e.target.value)}
          rows={8}
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok } = await confirmActionWithReason({
                title: '确认保存告警配置？',
                content: '保存后将影响告警规则与通知通道。',
                okText: '保存',
                reasonLabel: '变更原因（必填）',
                reasonRequired: true,
              });
              if (!ok) return;
              try {
                const payload = JSON.parse(alertJson) as AlertConfig;
                await apiPut<AlertConfig>('/admin/config/alerts', payload);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败，检查 JSON 格式');
              }
            }}
          >
            保存告警配置
          </Button>
        </Space>
      </Card>

      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          推荐配置（猜你喜欢）
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          权重可按运营策略/数据效果调整。
        </Typography.Paragraph>

        <Form form={recForm} layout="vertical">
          <Space wrap size={16}>
            <Form.Item
              label="启用推荐"
              name="enabled"
              valuePropName="checked"
              style={{ width: 220 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label="时间衰减半衰期（小时）"
              name="timeDecayHalfLifeHours"
              style={{ width: 220 }}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="去重窗口（小时）" name="dedupeWindowHours" style={{ width: 220 }}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Typography.Text strong>权重（weights）</Typography.Text>
          <Space wrap size={16} style={{ marginTop: 8 }}>
            {(['time', 'view', 'favorite', 'consult', 'region', 'user'] as const).map((k) => (
              <Form.Item key={k} label={k} name={['weights', k]} style={{ width: 180 }}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            ))}
          </Space>

          <Typography.Text strong>地域特色加权（featuredBoost）</Typography.Text>
          <Space wrap size={16} style={{ marginTop: 8 }}>
            <Form.Item label="省级" name={['featuredBoost', 'province']} style={{ width: 220 }}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="市级" name={['featuredBoost', 'city']} style={{ width: 220 }}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Button
            type="primary"
            onClick={async () => {
              const v = recForm.getFieldsValue(true);
              const { ok } = await confirmActionWithReason({
                title: '确认保存推荐配置？',
                content: '该操作会影响首页/搜索的推荐排序；建议填写变更原因并留痕。',
                okText: '保存',
                reasonLabel: '变更原因（必填）',
                reasonPlaceholder: '例：提高地域权重；降低时间衰减；活动期调权等。',
                reasonRequired: true,
              });
              if (!ok) return;
              try {
                await apiPut<RecommendationConfig>('/admin/config/recommendation', v);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败');
              }
            }}
          >
            保存推荐配置
          </Button>
        </Form>
      </Card>
    </Space>
  );
}

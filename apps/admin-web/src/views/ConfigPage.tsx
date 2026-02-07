import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Typography, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPut } from '../lib/api';
import { fenToYuanNumber, yuanToFen } from '../lib/format';
import { confirmActionWithReason } from '../ui/confirm';

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

type BannerConfig = {
  items: {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    enabled: boolean;
    order: number;
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
  artworkCategories: string[];
  calligraphyStyles: string[];
  paintingThemes: string[];
  artworkMaterials: string[];
};

type SensitiveWordsConfig = {
  words: string[];
};

type HotSearchConfig = {
  keywords: string[];
};

function toList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [tradeForm] = Form.useForm();
  const [recForm] = Form.useForm();
  const [bannerJson, setBannerJson] = useState('');
  const [csPhone, setCsPhone] = useState('');
  const [csDefaultReply, setCsDefaultReply] = useState('');
  const [csAssignStrategy, setCsAssignStrategy] = useState<CustomerServiceConfig['assignStrategy']>('AUTO');
  const [taxonomyIndustries, setTaxonomyIndustries] = useState('');
  const [taxonomyIpc, setTaxonomyIpc] = useState('');
  const [taxonomyLoc, setTaxonomyLoc] = useState('');
  const [taxonomyArtworkCategories, setTaxonomyArtworkCategories] = useState('');
  const [taxonomyCalligraphyStyles, setTaxonomyCalligraphyStyles] = useState('');
  const [taxonomyPaintingThemes, setTaxonomyPaintingThemes] = useState('');
  const [taxonomyArtworkMaterials, setTaxonomyArtworkMaterials] = useState('');
  const [sensitiveWords, setSensitiveWords] = useState('');
  const [hotSearchKeywords, setHotSearchKeywords] = useState('');

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

      const [banner, cs, taxonomy, sensitive, hotSearch] = await Promise.all([
        apiGet<BannerConfig>('/admin/config/banner'),
        apiGet<CustomerServiceConfig>('/admin/config/customer-service'),
        apiGet<TaxonomyConfig>('/admin/config/taxonomy'),
        apiGet<SensitiveWordsConfig>('/admin/config/sensitive-words'),
        apiGet<HotSearchConfig>('/admin/config/hot-search'),
      ]);

      setBannerJson(JSON.stringify(banner, null, 2));
      setCsPhone(cs.phone || '');
      setCsDefaultReply(cs.defaultReply || '');
      setCsAssignStrategy(cs.assignStrategy || 'AUTO');
      setTaxonomyIndustries((taxonomy.industries || []).join('，'));
      setTaxonomyIpc((taxonomy.ipcMappings || []).join('，'));
      setTaxonomyLoc((taxonomy.locMappings || []).join('，'));
      setTaxonomyArtworkCategories((taxonomy.artworkCategories || []).join('，'));
      setTaxonomyCalligraphyStyles((taxonomy.calligraphyStyles || []).join('，'));
      setTaxonomyPaintingThemes((taxonomy.paintingThemes || []).join('，'));
      setTaxonomyArtworkMaterials((taxonomy.artworkMaterials || []).join('，'));
      setSensitiveWords((sensitive.words || []).join('，'));
      setHotSearchKeywords((hotSearch.keywords || []).join('，'));
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [recForm, tradeForm]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
          Banner 配置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          维护首页轮播图（建议 JSON 编辑；保存前请确保格式正确）。
        </Typography.Paragraph>
        <Input.TextArea
          value={bannerJson}
          onChange={(e) => setBannerJson(e.target.value)}
          rows={8}
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok, reason } = await confirmActionWithReason({
                title: '确认保存 Banner 配置？',
                content: '保存后将影响首页轮播图展示。',
                okText: '保存',
                reasonLabel: '变更原因（建议填写）',
              });
              if (!ok) return;
              try {
                const payload = JSON.parse(bannerJson) as BannerConfig;
                await apiPut<BannerConfig>('/admin/config/banner', payload);
                message.success('已保存');
                void load();
              } catch (e: any) {
                message.error(e?.message || '保存失败，检查 JSON 格式');
              }
            }}
          >
            保存 Banner
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
              const { ok, reason } = await confirmActionWithReason({
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
          <Input.TextArea
            value={taxonomyArtworkCategories}
            onChange={(e) => setTaxonomyArtworkCategories(e.target.value)}
            rows={2}
            placeholder="书画类别"
          />
          <Input.TextArea
            value={taxonomyCalligraphyStyles}
            onChange={(e) => setTaxonomyCalligraphyStyles(e.target.value)}
            rows={2}
            placeholder="书法书体"
          />
          <Input.TextArea
            value={taxonomyPaintingThemes}
            onChange={(e) => setTaxonomyPaintingThemes(e.target.value)}
            rows={2}
            placeholder="国画题材"
          />
          <Input.TextArea
            value={taxonomyArtworkMaterials}
            onChange={(e) => setTaxonomyArtworkMaterials(e.target.value)}
            rows={2}
            placeholder="材质字典"
          />
        </Space>
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              const { ok, reason } = await confirmActionWithReason({
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
                  artworkCategories: toList(taxonomyArtworkCategories),
                  calligraphyStyles: toList(taxonomyCalligraphyStyles),
                  paintingThemes: toList(taxonomyPaintingThemes),
                  artworkMaterials: toList(taxonomyArtworkMaterials),
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
              const { ok, reason } = await confirmActionWithReason({
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
              const { ok, reason } = await confirmActionWithReason({
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

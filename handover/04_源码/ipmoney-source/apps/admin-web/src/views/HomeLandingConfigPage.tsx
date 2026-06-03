import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPut } from '../lib/api';
import { confirmActionWithReason } from '../ui/confirm';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';

type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'FIVE_STAR' | 'OPEN_LICENSE';
type PatentType = 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
type ActionType = 'SEARCH_PREFILL' | 'PAGE_ROUTE';
type SearchTab = 'LISTING' | 'ACHIEVEMENT';

type TopicUiItem = {
  value: ListingTopic;
  label: string;
  enabled: boolean;
  order: number;
};

type FeaturedItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  enabled: boolean;
  order: number;
  actionType: ActionType;
  actionPayload: {
    tab?: SearchTab;
    q?: string;
    reset?: boolean;
    listingTopic?: ListingTopic;
    patentType?: PatentType;
    url?: string;
  };
};

type HomeLandingConfig = {
  schemaVersion: 1;
  hero: {
    tags: string[];
    searchPlaceholder: string;
  };
  sectionTexts: {
    featuredTitle: string;
    featuredMoreText: string;
  };
  featuredZones: {
    enabled: boolean;
    displayCount: 4 | 6;
    items: FeaturedItem[];
  };
  listingTopicUi: {
    items: TopicUiItem[];
  };
};

const TOPIC_DEFAULTS: ReadonlyArray<TopicUiItem> = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利', enabled: true, order: 10 },
  { value: 'SLEEPING', label: '沉睡专利', enabled: true, order: 20 },
  { value: 'AWARD_WINNING', label: '获奖专利', enabled: true, order: 30 },
  { value: 'FIVE_STAR', label: '五星专利', enabled: true, order: 40 },
  { value: 'OPEN_LICENSE', label: '开放许可', enabled: true, order: 50 },
];

const TOPIC_SET = new Set<ListingTopic>(TOPIC_DEFAULTS.map((item) => item.value));
const PATENT_TYPE_SET = new Set<PatentType>(['INVENTION', 'UTILITY_MODEL', 'DESIGN']);
const FEATURED_BUILTIN_IMAGE_OPTIONS = [
  { label: '内置-退役专利', value: 'builtin://zone-retired' },
  { label: '内置-高新退役专利', value: 'builtin://zone-high-tech-retired' },
  { label: '内置-沉睡专利', value: 'builtin://zone-sleeping' },
  { label: '内置-获奖专利', value: 'builtin://zone-award-winning' },
  { label: '内置-五星专利', value: 'builtin://zone-five-star' },
  { label: '内置-开放许可', value: 'builtin://zone-open-license' },
];

function defaultHomeLandingConfig(): HomeLandingConfig {
  return {
    schemaVersion: 1,
    hero: {
      tags: ['0元专利托管', '0元代办过户', '0风险交易'],
      searchPlaceholder: '开始寻找被你发现的IP',
    },
    sectionTexts: {
      featuredTitle: '特色专区',
      featuredMoreText: '更多',
    },
    featuredZones: {
      enabled: true,
      displayCount: 4,
      items: [
        {
          id: 'retired',
          title: '退役专利',
          subtitle: '平台审核通过的退役专利',
          imageUrl: 'builtin://zone-retired',
          enabled: true,
          order: 10,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'HIGH_TECH_RETIRED', reset: true },
        },
        {
          id: 'sleeping',
          title: '沉睡专利',
          subtitle: '转让次数为 0 的专利',
          imageUrl: 'builtin://zone-sleeping',
          enabled: true,
          order: 20,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'SLEEPING', reset: true },
        },
        {
          id: 'award-winning',
          title: '获奖专利',
          subtitle: '平台标记的获奖专利',
          imageUrl: 'builtin://zone-award-winning',
          enabled: true,
          order: 30,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'AWARD_WINNING', reset: true },
        },
        {
          id: 'five-star',
          title: '五星专利',
          subtitle: '平台优选的高质量专利',
          imageUrl: 'builtin://zone-five-star',
          enabled: true,
          order: 40,
          actionType: 'SEARCH_PREFILL',
          actionPayload: { tab: 'LISTING', listingTopic: 'FIVE_STAR', reset: true },
        },
      ],
    },
    listingTopicUi: {
      items: [...TOPIC_DEFAULTS],
    },
  };
}

function normalizeTopicItems(input: unknown): TopicUiItem[] {
  const list = Array.isArray(input) ? input : [];
  const byValue = new Map<ListingTopic, any>();
  for (const raw of list) {
    const value = String((raw as any)?.value || '')
      .trim()
      .toUpperCase() as ListingTopic;
    if (!TOPIC_SET.has(value)) continue;
    if (byValue.has(value)) continue;
    byValue.set(value, raw);
  }

  return TOPIC_DEFAULTS.map((base) => {
    const raw = byValue.get(base.value) || {};
    const label = String(raw?.label || '').trim();
    const orderRaw = Number(raw?.order);
    return {
      value: base.value,
      label: (label || base.label).slice(0, 20),
      enabled: raw?.enabled !== false,
      order: Number.isSafeInteger(orderRaw) ? orderRaw : base.order,
    };
  }).sort((a, b) => a.order - b.order);
}

function normalizeFeaturedItems(input: unknown): FeaturedItem[] {
  const list = Array.isArray(input) ? input : [];
  const out: FeaturedItem[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i] as Record<string, unknown>;
    const id = String(raw?.id || '').trim();
    if (!id) continue;
    const actionTypeRaw = String(raw?.actionType || 'SEARCH_PREFILL')
      .trim()
      .toUpperCase();
    const actionType: ActionType = actionTypeRaw === 'PAGE_ROUTE' ? 'PAGE_ROUTE' : 'SEARCH_PREFILL';
    const payload =
      raw?.actionPayload && typeof raw.actionPayload === 'object'
        ? (raw.actionPayload as Record<string, unknown>)
        : {};

    const tabRaw = String(payload.tab || '')
      .trim()
      .toUpperCase();
    const topicRaw = String(payload.listingTopic || '')
      .trim()
      .toUpperCase() as ListingTopic;
    const patentTypeRaw = String(payload.patentType || '')
      .trim()
      .toUpperCase() as PatentType;
    const orderRaw = Number(raw?.order);

    out.push({
      id,
      title: String(raw?.title || '').trim().slice(0, 24),
      subtitle: String(raw?.subtitle || '').trim().slice(0, 40),
      imageUrl: String(raw?.imageUrl || '').trim().slice(0, 1000),
      enabled: raw?.enabled !== false,
      order: Number.isSafeInteger(orderRaw) ? orderRaw : (i + 1) * 10,
      actionType,
      actionPayload: {
        ...(tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT' ? { tab: tabRaw } : {}),
        ...(String(payload.q || '').trim() ? { q: String(payload.q || '').trim().slice(0, 120) } : {}),
        ...(TOPIC_SET.has(topicRaw) ? { listingTopic: topicRaw } : {}),
        ...(PATENT_TYPE_SET.has(patentTypeRaw) ? { patentType: patentTypeRaw } : {}),
        ...(actionType === 'PAGE_ROUTE' ? { url: String(payload.url || '').trim() } : {}),
        reset: payload.reset === undefined ? true : Boolean(payload.reset),
      },
    });
  }

  return out.sort((a, b) => a.order - b.order);
}

function normalizeHomeLandingConfig(input: unknown): HomeLandingConfig {
  const fallback = defaultHomeLandingConfig();
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const heroRaw = source.hero && typeof source.hero === 'object' ? (source.hero as Record<string, unknown>) : {};
  const sectionRaw =
    source.sectionTexts && typeof source.sectionTexts === 'object'
      ? (source.sectionTexts as Record<string, unknown>)
      : {};
  const featuredRaw =
    source.featuredZones && typeof source.featuredZones === 'object'
      ? (source.featuredZones as Record<string, unknown>)
      : {};
  const topicUiRaw =
    source.listingTopicUi && typeof source.listingTopicUi === 'object'
      ? (source.listingTopicUi as Record<string, unknown>)
      : {};

  const tags = (Array.isArray(heroRaw.tags) ? heroRaw.tags : fallback.hero.tags)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const searchPlaceholder = String(heroRaw.searchPlaceholder || fallback.hero.searchPlaceholder)
    .trim()
    .slice(0, 40);

  const displayCountRaw = Number(featuredRaw.displayCount);
  const displayCount: 4 | 6 = displayCountRaw === 6 ? 6 : 4;

  return {
    schemaVersion: 1,
    hero: {
      tags: tags.length ? tags : [...fallback.hero.tags],
      searchPlaceholder: searchPlaceholder || fallback.hero.searchPlaceholder,
    },
    sectionTexts: {
      featuredTitle:
        String(sectionRaw.featuredTitle || fallback.sectionTexts.featuredTitle)
          .trim()
          .slice(0, 20) || fallback.sectionTexts.featuredTitle,
      featuredMoreText:
        String(sectionRaw.featuredMoreText || fallback.sectionTexts.featuredMoreText)
          .trim()
          .slice(0, 10) || fallback.sectionTexts.featuredMoreText,
    },
    featuredZones: {
      enabled: featuredRaw.enabled !== false,
      displayCount,
      items: normalizeFeaturedItems(featuredRaw.items),
    },
    listingTopicUi: {
      items: normalizeTopicItems(topicUiRaw.items),
    },
  };
}

function makeFeaturedTemplate(index: number): FeaturedItem {
  return {
    id: `zone-${Date.now()}-${index}`,
    title: '新特色专区',
    subtitle: '请填写副标题',
    imageUrl: '',
    enabled: true,
    order: (index + 1) * 10,
    actionType: 'SEARCH_PREFILL',
    actionPayload: { tab: 'LISTING', reset: true },
  };
}

export function HomeLandingConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState('');
  const [form] = Form.useForm<HomeLandingConfig>();

  const listingTopicOptions = useMemo(
    () =>
      TOPIC_DEFAULTS.map((item) => ({
        value: item.value,
        label: item.label,
      })),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<HomeLandingConfig>('/admin/config/home-landing');
      const normalized = normalizeHomeLandingConfig(data);
      form.setFieldsValue(normalized);
      setJsonText(JSON.stringify(normalized, null, 2));
    } catch (e: any) {
      message.error(e?.message || '加载首页运营配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncJsonFromForm = useCallback(() => {
    const normalized = normalizeHomeLandingConfig(form.getFieldsValue(true));
    setJsonText(JSON.stringify(normalized, null, 2));
    return normalized;
  }, [form]);

  const validateBeforeSave = useCallback((payload: HomeLandingConfig): string | null => {
    const enabledTopics = new Set<ListingTopic>(
      (payload.listingTopicUi?.items || []).filter((it) => it.enabled).map((it) => it.value),
    );

    if (payload.featuredZones.enabled) {
      const enabledItems = (payload.featuredZones.items || []).filter((item) => item.enabled);
      if (enabledItems.length < payload.featuredZones.displayCount) {
        return `特色专区启用卡片数量不足，至少需要 ${payload.featuredZones.displayCount} 张。`;
      }
    }

    for (const item of payload.featuredZones.items || []) {
      if (!item.id.trim()) return '特色卡片 ID 不能为空。';
      if (!item.title.trim()) return `特色卡片(${item.id})标题不能为空。`;
      if (!item.subtitle.trim()) return `特色卡片(${item.id})副标题不能为空。`;
      if (!item.imageUrl.trim()) return `特色卡片(${item.id})图片地址不能为空。`;
      if (item.actionType === 'PAGE_ROUTE' && !String(item.actionPayload?.url || '').trim()) {
        return `特色卡片(${item.id})跳转页面地址不能为空。`;
      }
      if (item.actionType === 'SEARCH_PREFILL') {
        const topic = item.actionPayload?.listingTopic;
        if (topic && !enabledTopics.has(topic)) {
          return `特色卡片(${item.id})绑定的标签已被关闭，请先开启标签或修改卡片动作。`;
        }
      }
    }

    return null;
  }, []);

  const persist = useCallback(async (payload: HomeLandingConfig) => {
    const err = validateBeforeSave(payload);
    if (err) {
      message.error(err);
      return false;
    }

    const { ok } = await confirmActionWithReason({
      title: '确认保存首页运营配置？',
      content: '保存后将同步影响首页、特色专区、搜索筛选、发布页以及后台相关筛选选项。',
      okText: '保存',
      reasonLabel: '变更原因（建议填写）',
    });
    if (!ok) return false;

    setSaving(true);
    try {
      await apiPut<HomeLandingConfig>('/admin/config/home-landing', payload);
      message.success('已保存');
      form.setFieldsValue(payload);
      setJsonText(JSON.stringify(payload, null, 2));
      return true;
    } catch (e: any) {
      message.error(e?.message || '保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, validateBeforeSave]);

  const saveVisual = useCallback(async () => {
    const payload = syncJsonFromForm();
    await persist(payload);
  }, [persist, syncJsonFromForm]);

  const applyJsonToForm = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText) as HomeLandingConfig;
      const normalized = normalizeHomeLandingConfig(parsed);
      form.setFieldsValue(normalized);
      setJsonText(JSON.stringify(normalized, null, 2));
      message.success('已同步到可视化编辑区');
    } catch (e: any) {
      message.error(e?.message || 'JSON 格式错误，无法应用');
    }
  }, [form, jsonText]);

  const saveJson = useCallback(async () => {
    try {
      const parsed = JSON.parse(jsonText) as HomeLandingConfig;
      const normalized = normalizeHomeLandingConfig(parsed);
      await persist(normalized);
    } catch (e: any) {
      message.error(e?.message || 'JSON 格式错误，无法保存');
    }
  }, [jsonText, persist]);

  const panelItems = [
    {
      key: 'visual',
      label: '可视化编辑',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              基础文案
            </Typography.Title>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Form.Item label="Hero 标签 1" name={['hero', 'tags', 0]}>
                <Input maxLength={20} placeholder="例如：0元专利托管" />
              </Form.Item>
              <Form.Item label="Hero 标签 2" name={['hero', 'tags', 1]}>
                <Input maxLength={20} placeholder="例如：0元代办过户" />
              </Form.Item>
              <Form.Item label="Hero 标签 3" name={['hero', 'tags', 2]}>
                <Input maxLength={20} placeholder="例如：0风险交易" />
              </Form.Item>
              <Form.Item label="搜索框占位文案" name={['hero', 'searchPlaceholder']}>
                <Input maxLength={40} />
              </Form.Item>
              <Form.Item label="专区标题" name={['sectionTexts', 'featuredTitle']}>
                <Input maxLength={20} />
              </Form.Item>
              <Form.Item label="专区更多文案" name={['sectionTexts', 'featuredMoreText']}>
                <Input maxLength={10} />
              </Form.Item>
            </Space>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              特色专区基础设置
            </Typography.Title>
            <Space wrap size={16}>
              <Form.Item label="启用特色专区" name={['featuredZones', 'enabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="首页展示数量" name={['featuredZones', 'displayCount']}>
                <Select
                  style={{ width: 140 }}
                  options={[
                    { value: 4, label: '4 张' },
                    { value: 6, label: '6 张' },
                  ]}
                />
              </Form.Item>
            </Space>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              特色标签（全链路同步开关）
            </Typography.Title>
            <Form.List name={['listingTopicUi', 'items']}>
              {(fields) => (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Card key={field.key} size="small">
                      <Space wrap size={12}>
                        <Form.Item label="标签值" name={[field.name, 'value']} style={{ width: 220 }}>
                          <Select
                            options={listingTopicOptions}
                            disabled
                          />
                        </Form.Item>
                        <Form.Item label="中文名称" name={[field.name, 'label']} style={{ width: 220 }}>
                          <Input maxLength={20} />
                        </Form.Item>
                        <Form.Item label="排序" name={[field.name, 'order']} style={{ width: 140 }}>
                          <InputNumber min={1} step={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="可见/可选" name={[field.name, 'enabled']} valuePropName="checked" style={{ width: 140 }}>
                          <Switch />
                        </Form.Item>
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </Form.List>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              特色专区卡片
            </Typography.Title>
            <Form.List name={['featuredZones', 'items']}>
              {(fields, { add, remove, move }) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`卡片 ${index + 1}`}
                      extra={
                        <Space>
                          <Button size="small" disabled={index === 0} onClick={() => move(index, index - 1)}>
                            上移
                          </Button>
                          <Button
                            size="small"
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            下移
                          </Button>
                          <Button danger size="small" onClick={() => remove(field.name)}>
                            删除
                          </Button>
                        </Space>
                      }
                    >
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Space wrap size={12}>
                          <Form.Item label="ID" name={[field.name, 'id']} style={{ width: 220 }}>
                            <Input maxLength={40} placeholder="例如：retired" />
                          </Form.Item>
                          <Form.Item label="标题" name={[field.name, 'title']} style={{ width: 220 }}>
                            <Input maxLength={24} />
                          </Form.Item>
                          <Form.Item label="副标题" name={[field.name, 'subtitle']} style={{ width: 260 }}>
                            <Input maxLength={40} />
                          </Form.Item>
                        </Space>

                        <Space wrap size={12}>
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const path = ['featuredZones', 'items', field.name, 'imageUrl'] as [
                                'featuredZones',
                                'items',
                                number,
                                'imageUrl',
                              ];
                              const current = form.getFieldValue(path) as string | undefined;
                              return (
                                <Form.Item label="图片地址" style={{ width: 520 }}>
                                  <ImageUrlUploadField
                                    value={current}
                                    uploadPurpose="HOME_FEATURED_IMAGE"
                                    maxSizeMb={10}
                                    builtinOptions={FEATURED_BUILTIN_IMAGE_OPTIONS}
                                    placeholder="支持 builtin://zone-xxx 或安全链接"
                                    onChange={(next) => {
                                      form.setFieldValue(path, next);
                                      void syncJsonFromForm();
                                    }}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                          <Form.Item label="排序" name={[field.name, 'order']} style={{ width: 140 }}>
                            <InputNumber min={1} step={1} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item label="启用" name={[field.name, 'enabled']} valuePropName="checked" style={{ width: 120 }}>
                            <Switch />
                          </Form.Item>
                        </Space>

                        <Space wrap size={12}>
                          <Form.Item label="动作类型" name={[field.name, 'actionType']} style={{ width: 220 }}>
                            <Select
                              options={[
                                { value: 'SEARCH_PREFILL', label: '搜索预填（推荐）' },
                                { value: 'PAGE_ROUTE', label: '页面路由跳转' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item label="默认 Tab" name={[field.name, 'actionPayload', 'tab']} style={{ width: 180 }}>
                            <Select
                              allowClear
                              options={[
                                { value: 'LISTING', label: '专利交易' },
                                { value: 'ACHIEVEMENT', label: '专利成果' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item label="关键词 q" name={[field.name, 'actionPayload', 'q']} style={{ width: 220 }}>
                            <Input maxLength={120} allowClear />
                          </Form.Item>
                          <Form.Item label="reset" name={[field.name, 'actionPayload', 'reset']} valuePropName="checked" style={{ width: 120 }}>
                            <Switch />
                          </Form.Item>
                        </Space>

                        <Space wrap size={12}>
                          <Form.Item label="listingTopic" name={[field.name, 'actionPayload', 'listingTopic']} style={{ width: 220 }}>
                            <Select allowClear options={listingTopicOptions} />
                          </Form.Item>
                          <Form.Item label="patentType" name={[field.name, 'actionPayload', 'patentType']} style={{ width: 220 }}>
                            <Select
                              allowClear
                              options={[
                                { value: 'INVENTION', label: '发明' },
                                { value: 'UTILITY_MODEL', label: '实用新型' },
                                { value: 'DESIGN', label: '外观' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const actionType = form.getFieldValue(['featuredZones', 'items', field.name, 'actionType']) as ActionType;
                              if (actionType !== 'PAGE_ROUTE') return null;
                              return (
                                <Form.Item label="路由地址" name={[field.name, 'actionPayload', 'url']} style={{ width: 360 }}>
                                  <Input placeholder="例如：/subpackages/patent-square/index" />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Space>
                      </Space>
                    </Card>
                  ))}

                  <Button
                    onClick={() => {
                      const list = (form.getFieldValue(['featuredZones', 'items']) || []) as FeaturedItem[];
                      add(makeFeaturedTemplate(list.length));
                      setTimeout(() => {
                        void syncJsonFromForm();
                      }, 0);
                    }}
                  >
                    新增卡片
                  </Button>
                </Space>
              )}
            </Form.List>
          </Card>

          <Space>
            <Button onClick={() => void load()} disabled={saving}>
              重新加载
            </Button>
            <Button onClick={syncJsonFromForm} disabled={saving}>
              同步 JSON 预览
            </Button>
            <Button type="primary" loading={saving} onClick={() => void saveVisual()}>
              保存可视化配置
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      key: 'json',
      label: 'JSON模式',
      children: (
        <Card>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              高级模式用于批量粘贴或细粒度调整。保存前会执行结构标准化与必要校验。
            </Typography.Paragraph>
            <Input.TextArea
              rows={26}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="请输入 /admin/config/home-landing JSON"
            />
            <Space>
              <Button onClick={() => void load()} disabled={saving}>
                重新加载
              </Button>
              <Button onClick={applyJsonToForm} disabled={saving}>
                应用到可视化
              </Button>
              <Button type="primary" loading={saving} onClick={() => void saveJson()}>
                保存 JSON
              </Button>
            </Space>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          首页运营配置
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          可视化编辑优先，JSON 模式作为高级兜底。保存后实时生效。
        </Typography.Paragraph>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onValuesChange={() => {
          if (activeTab === 'visual') {
            void syncJsonFromForm();
          }
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'visual' | 'json')}
          items={panelItems}
        />
      </Form>
    </Space>
  );
}

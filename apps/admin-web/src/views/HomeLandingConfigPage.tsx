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
import { ArrowLeftOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiGet, apiPut } from '../lib/api';
import { isSuperAdminSession, type AdminSessionInfo } from '../lib/adminSession';
import { normalizeUserFacingText } from '../lib/userFacingText';
import { confirmActionWithReason } from '../ui/confirm';
import { ImageUrlUploadField } from '../ui/ImageUrlUploadField';

type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'FIVE_STAR' | 'OPEN_LICENSE';
type PatentType = 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
type ActionType = 'SEARCH_PREFILL';
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

type HeroSpotlight = {
  enabled: boolean;
  imageUrl: string;
  title: string;
  subtitle: string;
  actionPayload: {
    tab?: SearchTab;
    listingTopic?: ListingTopic;
    patentType?: PatentType;
    reset?: boolean;
  };
};

type HomeLandingConfig = {
  schemaVersion: 1;
  hero: {
    tags: string[];
    searchPlaceholder: string;
  };
  heroSpotlight: HeroSpotlight;
  sectionTexts: {
    featuredTitle: string;
    featuredMoreText: string;
  };
  featuredZones: {
    enabled: boolean;
    displayCount: 4;
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
const TOPIC_META: Record<ListingTopic, { featuredId: string; builtinImageUrl: string; defaultLabel: string }> = {
  HIGH_TECH_RETIRED: {
    featuredId: 'retired',
    builtinImageUrl: 'builtin://zone-retired',
    defaultLabel: '退役专利',
  },
  SLEEPING: {
    featuredId: 'sleeping',
    builtinImageUrl: 'builtin://zone-sleeping',
    defaultLabel: '沉睡专利',
  },
  AWARD_WINNING: {
    featuredId: 'award-winning',
    builtinImageUrl: 'builtin://zone-award-winning',
    defaultLabel: '获奖专利',
  },
  FIVE_STAR: {
    featuredId: 'five-star',
    builtinImageUrl: 'builtin://zone-five-star',
    defaultLabel: '五星专利',
  },
  OPEN_LICENSE: {
    featuredId: 'open-license',
    builtinImageUrl: 'builtin://zone-open-license',
    defaultLabel: '开放许可',
  },
};

const DEFAULT_FEATURED_ITEM_COUNT = 4;
const DEFAULT_HERO_SPOTLIGHT_IMAGE_URL = 'https://ipmoney.cn/static/images/assets/home/promo-certificate.png';

function normalizeOperatorText(value: unknown, fallback = '', maxLength = 1000): string {
  const normalized = normalizeUserFacingText(value);
  if (!normalized) return fallback;
  if (normalized.toLowerCase() === 'string') return fallback;
  return normalized.slice(0, maxLength);
}

function normalizePositiveOrder(value: unknown, fallback: number): number {
  const raw = Number(value);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : fallback;
}

function defaultBuiltinImageForTopic(topic?: ListingTopic | null): string {
  if (topic && TOPIC_META[topic]) {
    return TOPIC_META[topic].builtinImageUrl;
  }
  return TOPIC_META.HIGH_TECH_RETIRED.builtinImageUrl;
}

function defaultFeaturedIdForTopic(topic: ListingTopic | null | undefined, fallbackId: string, index: number): string {
  if (topic && TOPIC_META[topic]) {
    return TOPIC_META[topic].featuredId;
  }
  return fallbackId || `zone-${index + 1}`;
}

function defaultLabelForTopic(topic?: ListingTopic | null): string {
  if (topic && TOPIC_META[topic]) {
    return TOPIC_META[topic].defaultLabel;
  }
  return '特色卡片';
}

function normalizeHeroSpotlightActionPayload(input: unknown): HeroSpotlight['actionPayload'] {
  const payload = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const tabRaw = String(payload.tab || '')
    .trim()
    .toUpperCase();
  const listingTopicRaw = String(payload.listingTopic || '')
    .trim()
    .toUpperCase() as ListingTopic;
  const patentTypeRaw = String(payload.patentType || '')
    .trim()
    .toUpperCase() as PatentType;

  return {
    ...(tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT' ? { tab: tabRaw } : {}),
    ...(TOPIC_SET.has(listingTopicRaw) ? { listingTopic: listingTopicRaw } : {}),
    ...(PATENT_TYPE_SET.has(patentTypeRaw) ? { patentType: patentTypeRaw } : {}),
    reset: true,
  };
}

function normalizeHeroSpotlight(input: unknown): HeroSpotlight {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    enabled: source.enabled !== false,
    imageUrl: normalizeOperatorText(source.imageUrl, DEFAULT_HERO_SPOTLIGHT_IMAGE_URL, 1000),
    title: normalizeOperatorText(source.title, '', 24),
    subtitle: normalizeOperatorText(source.subtitle, '', 40),
    actionPayload: normalizeHeroSpotlightActionPayload(source.actionPayload),
  };
}

function defaultHomeLandingConfig(): HomeLandingConfig {
  return {
    schemaVersion: 1,
    hero: {
      tags: ['0元专利托管', '0元代办过户', '0风险交易'],
      searchPlaceholder: '开始寻找被你发现的IP',
    },
    heroSpotlight: {
      enabled: true,
      imageUrl: DEFAULT_HERO_SPOTLIGHT_IMAGE_URL,
      title: '',
      subtitle: '',
      actionPayload: {
        tab: 'LISTING',
        reset: true,
      },
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
          subtitle: '平台标记的沉睡专利',
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
    return {
      value: base.value,
      label: normalizeOperatorText(raw?.label, base.label, 20),
      enabled: raw?.enabled !== false,
      order: normalizePositiveOrder(raw?.order, base.order),
    };
  }).sort((a, b) => a.order - b.order);
}

function normalizeFeaturedItems(input: unknown, fallbackItems: FeaturedItem[]): FeaturedItem[] {
  const list = Array.isArray(input) ? input : [];
  const out: FeaturedItem[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i] as Record<string, unknown>;
    const fallbackItem = fallbackItems[i] || makeFeaturedTemplate(i);
    const id = normalizeOperatorText(raw?.id, fallbackItem.id, 40);
    if (!id) continue;
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
      title: normalizeOperatorText(raw?.title, fallbackItem.title, 24),
      subtitle: normalizeOperatorText(raw?.subtitle, fallbackItem.subtitle, 40),
      imageUrl: normalizeOperatorText(raw?.imageUrl, fallbackItem.imageUrl, 1000),
      enabled: raw?.enabled !== false,
      order: normalizePositiveOrder(orderRaw, fallbackItem.order),
      actionType: 'SEARCH_PREFILL',
      actionPayload: {
        ...(tabRaw === 'LISTING' || tabRaw === 'ACHIEVEMENT'
          ? { tab: tabRaw }
          : fallbackItem.actionPayload.tab
            ? { tab: fallbackItem.actionPayload.tab }
            : {}),
        ...(TOPIC_SET.has(topicRaw)
          ? { listingTopic: topicRaw }
          : fallbackItem.actionPayload.listingTopic
            ? { listingTopic: fallbackItem.actionPayload.listingTopic }
            : {}),
        ...(PATENT_TYPE_SET.has(patentTypeRaw)
          ? { patentType: patentTypeRaw }
          : fallbackItem.actionPayload.patentType
            ? { patentType: fallbackItem.actionPayload.patentType }
            : {}),
        reset: true,
      },
    });
  }

  const merged = [...out];
  for (const fallbackItem of fallbackItems) {
    if (merged.some((item) => item.id === fallbackItem.id)) continue;
    merged.push({ ...fallbackItem, actionPayload: { ...fallbackItem.actionPayload } });
  }

  return merged.sort((a, b) => a.order - b.order).slice(0, DEFAULT_FEATURED_ITEM_COUNT);
}

function deriveListingTopicUiItems(featuredItems: FeaturedItem[], rawTopicItems: unknown): TopicUiItem[] {
  const currentItems = normalizeTopicItems(rawTopicItems);
  const currentByValue = new Map<ListingTopic, TopicUiItem>(currentItems.map((item) => [item.value, item]));
  const firstEnabledCardByTopic = new Map<ListingTopic, FeaturedItem>();

  for (const item of [...featuredItems].sort((a, b) => a.order - b.order)) {
    if (!item.enabled) continue;
    const topic = item.actionPayload.listingTopic;
    if (!topic || firstEnabledCardByTopic.has(topic)) continue;
    firstEnabledCardByTopic.set(topic, item);
  }

  return TOPIC_DEFAULTS.map((base) => {
    const current = currentByValue.get(base.value) || base;
    const matchedCard = firstEnabledCardByTopic.get(base.value);
    return {
      value: base.value,
      label: matchedCard
        ? normalizeOperatorText(matchedCard.title, current.label || base.label, 20)
        : normalizeOperatorText(current.label, base.label, 20),
      enabled: Boolean(matchedCard),
      order: matchedCard ? normalizePositiveOrder(matchedCard.order, base.order) : normalizePositiveOrder(current.order, base.order),
    };
  }).sort((a, b) => a.order - b.order);
}

function buildPersistedHomeLandingConfig(input: HomeLandingConfig): HomeLandingConfig {
  const normalized = normalizeHomeLandingConfig(input);
  const heroSpotlightImage = normalizeOperatorText(
    normalized.heroSpotlight.imageUrl,
    DEFAULT_HERO_SPOTLIGHT_IMAGE_URL,
    1000,
  );
  const heroSpotlightTab = normalized.heroSpotlight.actionPayload.tab;
  const featuredItems = normalized.featuredZones.items.map((item, index) => {
    const topic = item.actionPayload.listingTopic;
    const defaultImageUrl = defaultBuiltinImageForTopic(topic);
    const currentImageUrl = normalizeOperatorText(item.imageUrl, defaultImageUrl, 1000);
    return {
      ...item,
      id: defaultFeaturedIdForTopic(topic, normalizeOperatorText(item.id, '', 40), index),
      title: normalizeOperatorText(item.title, defaultLabelForTopic(topic), 24),
      subtitle: normalizeOperatorText(item.subtitle, '请填写副标题', 40),
      imageUrl:
        currentImageUrl && !currentImageUrl.startsWith('builtin://') ? currentImageUrl : defaultImageUrl,
      order: normalizePositiveOrder(item.order, (index + 1) * 10),
      actionType: 'SEARCH_PREFILL' as const,
      actionPayload: {
        tab: item.actionPayload.tab === 'ACHIEVEMENT' ? 'ACHIEVEMENT' : 'LISTING',
        ...(topic ? { listingTopic: topic } : {}),
        ...(item.actionPayload.patentType ? { patentType: item.actionPayload.patentType } : {}),
        reset: true,
      },
    };
  });

  return {
    ...normalized,
    heroSpotlight: {
      enabled: normalized.heroSpotlight.enabled,
      imageUrl: heroSpotlightImage || DEFAULT_HERO_SPOTLIGHT_IMAGE_URL,
      title: normalizeOperatorText(normalized.heroSpotlight.title, '', 24),
      subtitle: normalizeOperatorText(normalized.heroSpotlight.subtitle, '', 40),
      actionPayload: {
        ...(heroSpotlightTab ? { tab: heroSpotlightTab } : {}),
        ...(heroSpotlightTab && normalized.heroSpotlight.actionPayload.listingTopic
          ? { listingTopic: normalized.heroSpotlight.actionPayload.listingTopic }
          : {}),
        ...(heroSpotlightTab && normalized.heroSpotlight.actionPayload.patentType
          ? { patentType: normalized.heroSpotlight.actionPayload.patentType }
          : {}),
        reset: true,
      },
    },
    featuredZones: {
      ...normalized.featuredZones,
      displayCount: 4,
      items: featuredItems,
    },
    listingTopicUi: {
      items: deriveListingTopicUiItems(featuredItems, normalized.listingTopicUi?.items),
    },
  };
}

function normalizeHomeLandingConfig(input: unknown): HomeLandingConfig {
  const fallback = defaultHomeLandingConfig();
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const heroRaw = source.hero && typeof source.hero === 'object' ? (source.hero as Record<string, unknown>) : {};
  const heroSpotlightRaw =
    source.heroSpotlight && typeof source.heroSpotlight === 'object'
      ? (source.heroSpotlight as Record<string, unknown>)
      : {};
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
  const fallbackFeaturedItems = fallback.featuredZones.items.map((item) => ({
    ...item,
    actionPayload: { ...item.actionPayload },
  }));

  const tags = (Array.isArray(heroRaw.tags) ? heroRaw.tags : fallback.hero.tags)
    .map((item, index) => normalizeOperatorText(item, fallback.hero.tags[index] || '', 20))
    .filter(Boolean)
    .slice(0, 3);
  const searchPlaceholder = normalizeOperatorText(heroRaw.searchPlaceholder, fallback.hero.searchPlaceholder, 40);

  return {
    schemaVersion: 1,
    hero: {
      tags: tags.length ? tags : [...fallback.hero.tags],
      searchPlaceholder: searchPlaceholder || fallback.hero.searchPlaceholder,
    },
    heroSpotlight: normalizeHeroSpotlight(heroSpotlightRaw),
    sectionTexts: {
      featuredTitle: normalizeOperatorText(sectionRaw.featuredTitle, fallback.sectionTexts.featuredTitle, 20),
      featuredMoreText: normalizeOperatorText(sectionRaw.featuredMoreText, fallback.sectionTexts.featuredMoreText, 10),
    },
    featuredZones: {
      enabled: featuredRaw.enabled !== false,
      displayCount: 4,
      items: normalizeFeaturedItems(featuredRaw.items, fallbackFeaturedItems),
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [canUseAdvancedEditor, setCanUseAdvancedEditor] = useState(false);
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
      const [data, session] = await Promise.all([
        apiGet<HomeLandingConfig>('/admin/config/home-landing'),
        apiGet<AdminSessionInfo>('/auth/session'),
      ]);
      const normalized = normalizeHomeLandingConfig(data);
      form.setFieldsValue(normalized);
      setJsonText(JSON.stringify(buildPersistedHomeLandingConfig(normalized), null, 2));
      const isSuperAdmin = isSuperAdminSession(session);
      setCanUseAdvancedEditor(isSuperAdmin);
      if (!isSuperAdmin) {
        setActiveTab('visual');
      }
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
    const payload = buildPersistedHomeLandingConfig(form.getFieldsValue(true));
    setJsonText(JSON.stringify(payload, null, 2));
    return payload;
  }, [form]);

  const validateBeforeSave = useCallback((payload: HomeLandingConfig): string | null => {
    if (payload.heroSpotlight.enabled && !payload.heroSpotlight.imageUrl.trim()) {
      return '首页固定展示图已启用时，必须上传展示图片。';
    }

    if (payload.featuredZones.enabled) {
      const enabledItems = (payload.featuredZones.items || []).filter((item) => item.enabled);
      if (enabledItems.length < DEFAULT_FEATURED_ITEM_COUNT) {
        return '首页特色专区固定展示 4 张卡片，请保持 4 张卡片都为启用状态。';
      }
    }

    const usedTopics = new Set<ListingTopic>();
    for (const item of payload.featuredZones.items || []) {
      if (!item.title.trim()) return `特色卡片(${item.id})标题不能为空。`;
      if (!item.subtitle.trim()) return `特色卡片(${item.id})副标题不能为空。`;
      if (!item.imageUrl.trim()) return `特色卡片(${item.id})图片地址不能为空。`;
      if (!item.actionPayload?.tab) {
        return `特色卡片(${item.id})请选择点击后进入的频道。`;
      }
      const topic = item.actionPayload?.listingTopic;
      if (!topic) {
        return `特色卡片(${item.id})请选择点击后筛到的标签。`;
      }
      if (usedTopics.has(topic)) {
        return `特色卡片(${item.id})和其他卡片用了同一个筛选标签，请改成不同标签。`;
      }
      usedTopics.add(topic);
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
      title: '确认保存首页展示内容？',
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
      setJsonText(JSON.stringify(buildPersistedHomeLandingConfig(normalized), null, 2));
      message.success('已同步到可视化编辑区');
    } catch (e: any) {
      message.error(e?.message || '高级文本格式错误，无法应用');
    }
  }, [form, jsonText]);

  const saveJson = useCallback(async () => {
    try {
      const parsed = JSON.parse(jsonText) as HomeLandingConfig;
      const payload = buildPersistedHomeLandingConfig(parsed);
      await persist(payload);
    } catch (e: any) {
      message.error(e?.message || '高级文本格式错误，无法保存');
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
              首页首屏文案
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              这里改的是首页最上面第一屏的卖点短语、搜索框提示词，以及“特色专区”的标题文案。
            </Typography.Paragraph>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
                width: '100%',
              }}
            >
              <Form.Item label="首页卖点 1" name={['hero', 'tags', 0]} style={{ marginBottom: 0 }}>
                <Input maxLength={20} placeholder="例如：0元专利托管" />
              </Form.Item>
              <Form.Item label="首页卖点 2" name={['hero', 'tags', 1]} style={{ marginBottom: 0 }}>
                <Input maxLength={20} placeholder="例如：0元代办过户" />
              </Form.Item>
              <Form.Item label="首页卖点 3" name={['hero', 'tags', 2]} style={{ marginBottom: 0 }}>
                <Input maxLength={20} placeholder="例如：0风险交易" />
              </Form.Item>
              <Form.Item label="搜索框占位文案" name={['hero', 'searchPlaceholder']} style={{ marginBottom: 0 }}>
                <Input maxLength={40} placeholder="例如：开始寻找被你发现的IP" />
              </Form.Item>
              <Form.Item label="特色专区标题" name={['sectionTexts', 'featuredTitle']} style={{ marginBottom: 0 }}>
                <Input maxLength={20} placeholder="例如：特色专区" />
              </Form.Item>
              <Form.Item label="“更多”按钮文案" name={['sectionTexts', 'featuredMoreText']} style={{ marginBottom: 0 }}>
                <Input maxLength={10} placeholder="例如：更多" />
              </Form.Item>
            </div>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              首页固定展示图
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              这里修改首页这张主展示图的图片、文案和点击后的去向。
            </Typography.Paragraph>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap size={16}>
                <Form.Item label="是否显示" name={['heroSpotlight', 'enabled']} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Space>

              <Form.Item shouldUpdate noStyle>
                {() => {
                  const imagePath = ['heroSpotlight', 'imageUrl'] as const;
                  const tabPath = ['heroSpotlight', 'actionPayload', 'tab'] as const;
                  const currentImage = form.getFieldValue(imagePath) as string | undefined;
                  const currentTab = form.getFieldValue(tabPath) as SearchTab | undefined;
                  const destinationValue = currentTab || 'NONE';

                  return (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Form.Item label="展示图片" style={{ width: 520, marginBottom: 0 }}>
                        <ImageUrlUploadField
                          value={currentImage}
                          uploadPurpose="HOME_HERO_SPOTLIGHT_IMAGE"
                          maxSizeMb={10}
                          allowUrlInput={false}
                          uploadButtonText="上传展示图片"
                          onChange={(next) => {
                            form.setFieldValue(imagePath, next);
                            void syncJsonFromForm();
                          }}
                        />
                      </Form.Item>

                      <Space wrap size={12}>
                        <Form.Item label="主标题" name={['heroSpotlight', 'title']} style={{ width: 260, marginBottom: 0 }}>
                          <Input maxLength={24} placeholder="可不填，例如：证书交易专区" />
                        </Form.Item>
                        <Form.Item label="副标题" name={['heroSpotlight', 'subtitle']} style={{ width: 320, marginBottom: 0 }}>
                          <Input maxLength={40} placeholder="可不填，例如：平台精选证书可直接查看" />
                        </Form.Item>
                      </Space>

                      <Space wrap size={12} align="start">
                        <Form.Item label="点击后去哪里" style={{ width: 240, marginBottom: 0 }}>
                          <Select
                            value={destinationValue}
                            options={[
                              { value: 'NONE', label: '不跳转' },
                              { value: 'LISTING', label: '进入专利交易列表' },
                              { value: 'ACHIEVEMENT', label: '进入专利成果列表' },
                            ]}
                            onChange={(next) => {
                              if (next === 'NONE') {
                                form.setFields([
                                  { name: ['heroSpotlight', 'actionPayload', 'tab'], value: undefined },
                                  { name: ['heroSpotlight', 'actionPayload', 'listingTopic'], value: undefined },
                                  { name: ['heroSpotlight', 'actionPayload', 'patentType'], value: undefined },
                                ]);
                              } else {
                                form.setFieldValue(['heroSpotlight', 'actionPayload', 'tab'], next);
                              }
                              void syncJsonFromForm();
                            }}
                          />
                        </Form.Item>

                        {destinationValue !== 'NONE' ? (
                          <>
                            <Form.Item
                              label="筛选标签"
                              name={['heroSpotlight', 'actionPayload', 'listingTopic']}
                              style={{ width: 220, marginBottom: 0 }}
                            >
                              <Select allowClear options={listingTopicOptions} placeholder="可不限制" />
                            </Form.Item>
                            <Form.Item
                              label="专利类型"
                              name={['heroSpotlight', 'actionPayload', 'patentType']}
                              style={{ width: 220, marginBottom: 0 }}
                            >
                              <Select
                                allowClear
                                placeholder="可不限制"
                                options={[
                                  { value: 'INVENTION', label: '发明' },
                                  { value: 'UTILITY_MODEL', label: '实用新型' },
                                  { value: 'DESIGN', label: '外观' },
                                ]}
                              />
                            </Form.Item>
                          </>
                        ) : null}
                      </Space>
                    </Space>
                  );
                }}
              </Form.Item>
            </Space>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              特色专区基础设置
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              首页特色专区固定展示 4 张卡片。系统会按“展示顺序”从小到大，自动取前 4 张启用中的卡片显示在首页。
            </Typography.Paragraph>
            <Space wrap size={16}>
              <Form.Item label="启用特色专区" name={['featuredZones', 'enabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Typography.Text type="secondary">首页固定展示：4 张</Typography.Text>
            </Space>
          </Card>

          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              首页特色入口
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              首页固定维护 4 张特色卡片。每张卡片只需要设置展示内容和点击后的筛选条件，用户点击后会固定进入列表页。
            </Typography.Paragraph>
            <Form.List name={['featuredZones', 'items']}>
              {(fields) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field, index) => (
                    <Card key={field.key} size="small" title={`卡片 ${index + 1}`}>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Typography.Text strong>展示内容</Typography.Text>
                        <Space wrap size={12}>
                          <Form.Item label="卡片标题" name={[field.name, 'title']} style={{ width: 220 }}>
                            <Input maxLength={24} placeholder="例如：退役专利" />
                          </Form.Item>
                          <Form.Item label="卡片副标题" name={[field.name, 'subtitle']} style={{ width: 260 }}>
                            <Input maxLength={40} placeholder="例如：平台审核通过的退役专利" />
                          </Form.Item>
                        </Space>

                        <Typography.Text strong>卡片图片</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          未上传自定义图片时，系统会自动使用当前筛选标签对应的默认配图。
                        </Typography.Paragraph>
                        <Space wrap size={12} align="start">
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const imagePath = ['featuredZones', 'items', field.name, 'imageUrl'] as [
                                'featuredZones',
                                'items',
                                number,
                                'imageUrl',
                              ];
                              const topicPath = ['featuredZones', 'items', field.name, 'actionPayload', 'listingTopic'] as [
                                'featuredZones',
                                'items',
                                number,
                                'actionPayload',
                                'listingTopic',
                              ];
                              const currentImage = form.getFieldValue(imagePath) as string | undefined;
                              const selectedTopic = form.getFieldValue(topicPath) as ListingTopic | undefined;
                              return (
                                <Form.Item label="卡片图片" style={{ width: 520 }}>
                                  <ImageUrlUploadField
                                    value={currentImage}
                                    uploadPurpose="HOME_FEATURED_IMAGE"
                                    maxSizeMb={10}
                                    allowUrlInput={false}
                                    uploadButtonText="上传替换图片"
                                    builtinDisplayText={
                                      selectedTopic
                                        ? `当前使用“${defaultLabelForTopic(selectedTopic)}”的系统默认配图，上传后会自动替换。`
                                        : '请先选择筛选标签，系统会自动带出默认配图。'
                                    }
                                    onChange={(next) => {
                                      form.setFieldValue(imagePath, next);
                                      void syncJsonFromForm();
                                    }}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                          <Form.Item label="展示顺序" name={[field.name, 'order']} style={{ width: 140 }}>
                            <InputNumber min={1} step={1} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item label="是否显示" name={[field.name, 'enabled']} valuePropName="checked" style={{ width: 120 }}>
                            <Switch />
                          </Form.Item>
                        </Space>

                        <Typography.Text strong>点击后的筛选条件</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          用户点击这张卡片后，会直接进入列表页，并自动带上下面的筛选条件。
                        </Typography.Paragraph>
                        <Space wrap size={12} align="start">
                          <Form.Item label="进入频道" name={[field.name, 'actionPayload', 'tab']} style={{ width: 180 }}>
                            <Select
                              options={[
                                { value: 'LISTING', label: '专利交易' },
                                { value: 'ACHIEVEMENT', label: '专利成果' },
                              ]}
                            />
                          </Form.Item>
                          <Form.Item label="筛选标签" name={[field.name, 'actionPayload', 'listingTopic']} style={{ width: 220 }}>
                            <Select
                              options={listingTopicOptions}
                              placeholder="请选择标签"
                              onChange={(next) => {
                                const topic = (next || undefined) as ListingTopic | undefined;
                                const imagePath = ['featuredZones', 'items', field.name, 'imageUrl'] as const;
                                const currentImage = String(form.getFieldValue(imagePath) || '').trim();
                                if (!currentImage || currentImage.startsWith('builtin://')) {
                                  form.setFieldValue(imagePath, defaultBuiltinImageForTopic(topic));
                                }
                                void syncJsonFromForm();
                              }}
                            />
                          </Form.Item>
                          <Form.Item label="专利类型" name={[field.name, 'actionPayload', 'patentType']} style={{ width: 220 }}>
                            <Select
                              allowClear
                              placeholder="不限制时可留空"
                              options={[
                                { value: 'INVENTION', label: '发明' },
                                { value: 'UTILITY_MODEL', label: '实用新型' },
                                { value: 'DESIGN', label: '外观' },
                              ]}
                            />
                          </Form.Item>
                        </Space>
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </Form.List>
          </Card>

          <Space>
            <Button onClick={() => void load()} disabled={saving}>
              重新加载
            </Button>
            <Button onClick={syncJsonFromForm} disabled={saving}>
              刷新预览数据
            </Button>
            <Button type="primary" loading={saving} onClick={() => void saveVisual()}>
              保存首页展示内容
            </Button>
          </Space>
        </Space>
      ),
    },
    ...(canUseAdvancedEditor
      ? [
          {
            key: 'json',
            label: '管理员高级编辑',
            children: (
              <Card>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    仅在需要批量粘贴或做精细调整时使用。普通运营优先使用上方可视化编辑，保存前系统会自动做结构校验。
                  </Typography.Paragraph>
                  <Input.TextArea
                    rows={26}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder="请输入首页展示内容的配置文本"
                  />
                  <Space>
                    <Button onClick={() => void load()} disabled={saving}>
                      重新加载
                    </Button>
                    <Button onClick={applyJsonToForm} disabled={saving}>
                      应用到可视化
                    </Button>
                    <Button type="primary" loading={saving} onClick={() => void saveJson()}>
                      保存高级编辑内容
                    </Button>
                  </Space>
                </Space>
              </Card>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/config')} style={{ alignSelf: 'flex-start' }}>
            返回系统配置页
          </Button>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            首页展示内容
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这里是首页展示内容的专用编辑页。请优先使用上方表单修改文案、图片、专区和排序；普通运营不会看到高级配置文本，只有管理员排查问题时才会显示。
          </Typography.Paragraph>
        </Space>
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

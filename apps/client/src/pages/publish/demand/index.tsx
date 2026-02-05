import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { ensureApproved, requireLogin } from '../../../lib/guard';
import { auditStatusLabel, contentStatusLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { IndustryTagsPicker, TagInput } from '../../../ui/filters';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';

type Demand = components['schemas']['Demand'];
type DemandCreateRequest = components['schemas']['DemandCreateRequest'];
type DemandUpdateRequest = components['schemas']['DemandUpdateRequest'];
type CooperationMode = components['schemas']['CooperationMode'];
type PriceType = components['schemas']['PriceType'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type ContentMedia = components['schemas']['ContentMedia'];
type DeliveryPeriod = components['schemas']['DeliveryPeriod'];

type UploadFileRes = components['schemas']['FileObject'] & { fileName?: string };

const MAX_IMAGE_COUNT = 9;
const MAX_VIDEO_COUNT = 1;
const MAX_FILE_COUNT = 3;
const MAX_TOTAL_MEDIA_COUNT = 12;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function parseMoneyFen(input: string): number | undefined {
  const s = (input || '').trim().replace(/,/g, '');
  if (!s) return undefined;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return undefined;
  const [a, bRaw] = s.split('.', 2);
  const b = (bRaw || '').padEnd(2, '0').slice(0, 2);
  const yuan = Number(a);
  const fen = Number(b);
  if (!Number.isFinite(yuan) || !Number.isFinite(fen)) return undefined;
  return yuan * 100 + fen;
}

function mergePlaceholderClass(extra?: string): string {
  return extra ? `publish-placeholder ${extra}` : 'publish-placeholder';
}

function mergePlaceholderStyle(extra?: string): string {
  const base = 'font-size:20rpx;color:#c0c4cc;';
  if (!extra) return base;
  return `${base}${extra}`;
}

function PublishInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

function PublishTextArea(props: React.ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...props}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

const COOPERATION_MODES: Array<{ mode: CooperationMode; label: string }> = [
  { mode: 'TRANSFER', label: '专利转让' },
  { mode: 'TECH_CONSULTING', label: '技术咨询' },
  { mode: 'COMMISSIONED_DEV', label: '委托开发' },
  { mode: 'PLATFORM_CO_BUILD', label: '平台共建' },
];

const DELIVERY_PERIODS: Array<{ value: DeliveryPeriod; label: string }> = [
  { value: 'WITHIN_1_MONTH', label: '≤1月' },
  { value: 'MONTH_1_3', label: '1-3月' },
  { value: 'MONTH_3_6', label: '3-6月' },
  { value: 'OVER_6_MONTHS', label: '≥6月' },
  { value: 'OTHER', label: '其他' },
];

function sortMedia(items: ContentMedia[]): ContentMedia[] {
  return [...(items || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

function countMediaByType(items: ContentMedia[], type: ContentMedia['type']): number {
  return (items || []).filter((m) => m?.type === type).length;
}

async function uploadFile(filePath: string, opts?: { purpose?: string }): Promise<UploadFileRes> {
  if (!requireLogin()) throw new Error('请先登录');

  const scenario = Taro.getStorageSync(STORAGE_KEYS.mockScenario) || 'happy';
  const token = getToken();
  const uploadRes = await Taro.uploadFile({
    url: `${API_BASE_URL}/files`,
    filePath,
    name: 'file',
    formData: { purpose: opts?.purpose || 'OTHER' },
    header: {
      'X-Mock-Scenario': scenario,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = JSON.parse(String(uploadRes.data || '{}')) as UploadFileRes;
  if (!json.id) throw new Error('上传失败');
  return json;
}

export default function PublishDemandPage() {
  const router = useRouter();
  const initialDemandId = useMemo(() => String(router?.params?.demandId || ''), [router?.params?.demandId]);

  const [demandId, setDemandId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [status, setStatus] = useState<ContentStatus | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [deliveryPeriod, setDeliveryPeriod] = useState<DeliveryPeriod | ''>('');

  const [budgetType, setBudgetType] = useState<PriceType | ''>('NEGOTIABLE');
  const [budgetMinYuan, setBudgetMinYuan] = useState('');
  const [budgetMaxYuan, setBudgetMaxYuan] = useState('');

  const [cooperationModes, setCooperationModes] = useState<CooperationMode[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactPhoneMasked, setContactPhoneMasked] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [industryTags, setIndustryTags] = useState<string[]>([]);

  const [coverFileId, setCoverFileId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [media, setMedia] = useState<ContentMedia[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offShelving, setOffShelving] = useState(false);

  useEffect(() => {
    if (!initialDemandId) return;
    if (demandId) return;

    (async () => {
      if (!ensureApproved()) return;
      try {
        const d = await apiGet<Demand>(`/demands/${initialDemandId}`);
        setDemandId(d.id);
        setAuditStatus(d.auditStatus || null);
        setStatus(d.status || null);

        setTitle(d.title || '');
        setSummary(d.summary || '');
        setDescription(d.description || '');
        setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
        setDeliveryPeriod((d.deliveryPeriod || '') as DeliveryPeriod | '');

        setBudgetType((d.budgetType || 'NEGOTIABLE') as PriceType);
        setBudgetMinYuan(d.budgetMinFen !== undefined ? fenToYuan(d.budgetMinFen, { empty: '' }) : '');
        setBudgetMaxYuan(d.budgetMaxFen !== undefined ? fenToYuan(d.budgetMaxFen, { empty: '' }) : '');

        setCooperationModes((d.cooperationModes || []) as CooperationMode[]);
        setContactName(d.contactName || '');
        setContactTitle(d.contactTitle || '');
        setContactPhoneMasked(d.contactPhoneMasked || '');
        setRegionCode(d.regionCode || '');
        setIndustryTags(Array.isArray(d.industryTags) ? d.industryTags : []);

        setCoverFileId(d.coverFileId ?? null);
        setCoverUrl(d.coverUrl || null);
        setMedia(sortMedia((d.media || []) as ContentMedia[]));
      } catch (e: any) {
        toast(e?.message || '加载失败');
      }
    })();
  }, [demandId, initialDemandId]);

  const toggleMode = useCallback((mode: CooperationMode) => {
    setCooperationModes((prev) => {
      const set = new Set(prev);
      if (set.has(mode)) set.delete(mode);
      else set.add(mode);
      return Array.from(set);
    });
  }, []);

  const setCover = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      const size = chosen?.tempFiles?.[0]?.size;
      if (!filePath) return;
      if (typeof size === 'number' && size > MAX_IMAGE_BYTES) {
        toast(`封面图过大（≤${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setCoverFileId(f.id);
      setCoverUrl(f.url || null);
      toast('封面已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [uploading]);

  const removeCover = useCallback(async () => {
    const ok = await confirm({ title: '移除封面', content: '确定移除封面图？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setCoverFileId(null);
    setCoverUrl(null);
  }, []);

  const addImage = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (media.length >= MAX_TOTAL_MEDIA_COUNT) {
      toast(`附件数量已达上限（≤${MAX_TOTAL_MEDIA_COUNT}）`);
      return;
    }
    if (countMediaByType(media, 'IMAGE') >= MAX_IMAGE_COUNT) {
      toast(`图片最多 ${MAX_IMAGE_COUNT} 张`);
      return;
    }
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      const size = chosen?.tempFiles?.[0]?.size;
      if (!filePath) return;
      if (typeof size === 'number' && size > MAX_IMAGE_BYTES) {
        toast(`图片过大（≤${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [...prev, { fileId: f.id, type: 'IMAGE', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: f.fileName } as any]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [media, uploading]);

  const addVideo = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (media.length >= MAX_TOTAL_MEDIA_COUNT) {
      toast(`附件数量已达上限（≤${MAX_TOTAL_MEDIA_COUNT}）`);
      return;
    }
    if (countMediaByType(media, 'VIDEO') >= MAX_VIDEO_COUNT) {
      toast('视频最多 1 个');
      return;
    }
    setUploading(true);
    try {
      const chosen = await Taro.chooseVideo({ sourceType: ['album', 'camera'], compressed: true });
      const filePath = (chosen as any)?.tempFilePath as string | undefined;
      const size = (chosen as any)?.size as number | undefined;
      if (!filePath) return;
      if (typeof size === 'number' && size > MAX_VIDEO_BYTES) {
        toast(`视频过大（≤${Math.floor(MAX_VIDEO_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [...prev, { fileId: f.id, type: 'VIDEO', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: f.fileName } as any]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [media, uploading]);

  const addFile = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (media.length >= MAX_TOTAL_MEDIA_COUNT) {
      toast(`附件数量已达上限（≤${MAX_TOTAL_MEDIA_COUNT}）`);
      return;
    }
    if (countMediaByType(media, 'FILE') >= MAX_FILE_COUNT) {
      toast(`文件最多 ${MAX_FILE_COUNT} 个`);
      return;
    }
    setUploading(true);
    try {
      const chooseMessageFile = (Taro as any).chooseMessageFile as any;
      if (!chooseMessageFile) {
        toast('请在小程序内上传文件');
        return;
      }
      const chosen = await chooseMessageFile({ count: 1, type: 'file' });
      const filePath = chosen?.tempFiles?.[0]?.path as string | undefined;
      const size = chosen?.tempFiles?.[0]?.size as number | undefined;
      const name = chosen?.tempFiles?.[0]?.name as string | undefined;
      if (!filePath) return;
      if (typeof size === 'number' && size > MAX_FILE_BYTES) {
        toast(`文件过大（≤${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [...prev, { fileId: f.id, type: 'FILE', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: name || f.fileName } as any]);
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [media, uploading]);

  const removeMedia = useCallback(async (fileId: string) => {
    const ok = await confirm({ title: '移除附件', content: '确定移除该附件？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setMedia((prev) => prev.filter((m) => m.fileId !== fileId).map((m, idx) => ({ ...m, sort: idx })));
  }, []);

  const buildCreate = useCallback(
    (mode: 'save' | 'submit'): DemandCreateRequest | null => {
      const t = title.trim();
      const keywordList = keywords.map((k) => k.trim()).filter(Boolean);
      if (mode === 'submit' && !t) {
        toast('请填写标题');
        return null;
      }
      if (mode === 'submit' && !description.trim()) {
        toast('请填写需求详情');
        return null;
      }
      if (mode === 'submit' && !keywordList.length) {
        toast('请至少添加 1 个关键词');
        return null;
      }
      if (mode === 'submit' && !media.length) {
        toast('请至少上传 1 个附件/媒体');
        return null;
      }
      if (mode === 'submit' && countMediaByType(media, 'VIDEO') > 0 && !coverFileId) {
        toast('包含视频时建议设置封面图');
        return null;
      }

      const req: DemandCreateRequest = {
        title: t || '未命名需求',
        ...(summary.trim() ? { summary: summary.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(keywordList.length ? { keywords: keywordList } : {}),
        ...(deliveryPeriod ? { deliveryPeriod } : {}),
        ...(budgetType ? { budgetType } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(industryTags.length ? { industryTags } : {}),
        ...(cooperationModes.length ? { cooperationModes } : {}),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(contactTitle.trim() ? { contactTitle: contactTitle.trim() } : {}),
        ...(contactPhoneMasked.trim() ? { contactPhoneMasked: contactPhoneMasked.trim() } : {}),
        ...(coverFileId ? { coverFileId } : {}),
        ...(media.length ? { media: media.map((m, idx) => ({ fileId: m.fileId, type: m.type, sort: idx })) } : {}),
      };

      if (budgetType === 'FIXED') {
        const minFen = parseMoneyFen(budgetMinYuan);
        const maxFen = parseMoneyFen(budgetMaxYuan);
        if (mode === 'submit' && (minFen === undefined || maxFen === undefined)) {
          toast('请填写预算范围（元）');
          return null;
        }
        if (minFen !== undefined) (req as any).budgetMinFen = minFen;
        if (maxFen !== undefined) (req as any).budgetMaxFen = maxFen;
        if (minFen !== undefined && maxFen !== undefined && minFen > maxFen) {
          toast('预算范围不正确（最小值应 ≤ 最大值）');
          return null;
        }
      }

      return req;
    },
    [
      budgetMaxYuan,
      budgetMinYuan,
      budgetType,
      contactName,
      contactPhoneMasked,
      contactTitle,
      cooperationModes,
      coverFileId,
      deliveryPeriod,
      description,
      industryTags,
      keywords,
      media,
      regionCode,
      summary,
      title,
    ],
  );

  const buildUpdate = useCallback(
    (mode: 'save' | 'submit'): DemandUpdateRequest | null => {
      const req = buildCreate(mode);
      if (!req) return null;
      const { title: t, ...rest } = req as any;
      return { title: t, ...rest } as DemandUpdateRequest;
    },
    [buildCreate],
  );

  const saveDraft = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    setSaving(true);
    try {
      let res: Demand;
      if (!demandId) {
        const req = buildCreate('save');
        if (!req) return;
        res = await apiPost<Demand>('/demands', req, { idempotencyKey: `demo-demand-create-${Date.now()}` });
        setDemandId(res.id);
      } else {
        const req = buildUpdate('save');
        if (!req) return;
        res = await apiPatch<Demand>(`/demands/${demandId}`, req, { idempotencyKey: `demo-demand-patch-${demandId}` });
      }
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('草稿已保存', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [buildCreate, buildUpdate, demandId, saving, submitting]);

  const submitForAudit = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '提交审核',
      content: '提交后将进入“审核中”，审核通过后对外展示；默认仅支持站内咨询/消息留痕。',
      confirmText: '提交',
      cancelText: '再检查一下',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      let id = demandId;
      if (!id) {
        const req = buildCreate('submit');
        if (!req) return;
        const created = await apiPost<Demand>('/demands', req, { idempotencyKey: `demo-demand-create-submit-${Date.now()}` });
        id = created.id;
        setDemandId(created.id);
        setAuditStatus(created.auditStatus || null);
        setStatus(created.status || null);
      } else {
        const req = buildUpdate('submit');
        if (!req) return;
        const updated = await apiPatch<Demand>(`/demands/${id}`, req, { idempotencyKey: `demo-demand-patch-submit-${id}` });
        setAuditStatus(updated.auditStatus || null);
        setStatus(updated.status || null);
      }

      const res = await apiPost<Demand>(`/demands/${id}/submit`, undefined, { idempotencyKey: `demo-demand-submit-${id}` });
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已提交审核', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [buildCreate, buildUpdate, demandId, saving, submitting]);

  const offShelf = useCallback(async () => {
    if (!demandId) return;
    if (offShelving) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '下架需求',
      content: '下架后将不再对外展示，可在草稿中继续编辑。',
      confirmText: '下架',
      cancelText: '取消',
    });
    if (!ok) return;

    setOffShelving(true);
    try {
      const res = await apiPost<Demand>(`/demands/${demandId}/off-shelf`, { reason: '发布方下架' }, { idempotencyKey: `demo-demand-off-${demandId}` });
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已下架', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    } finally {
      setOffShelving(false);
    }
  }, [demandId, offShelving]);

  const canEdit = auditStatus !== 'PENDING';

  return (
    <View className="container has-sticky publish-demand-page">
      <PageHeader back fallbackUrl="/pages/publish/index" title="发布：产学研需求" brand={false} />
      <Spacer />

      <Surface>
        <Text className="text-strong">状态</Text>
        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
          <Text className="tag">{status ? contentStatusLabel(status) : '-'}</Text>
          <Text className={`tag ${auditStatus === 'APPROVED' ? 'tag-success' : auditStatus === 'REJECTED' ? 'tag-danger' : 'tag-warning'}`}>
            {auditStatus ? auditStatusLabel(auditStatus) : '-'}
          </Text>
          {demandId ? <Text className="tag">ID：{demandId.slice(0, 8)}</Text> : <Text className="tag">未创建</Text>}
        </View>
        {auditStatus === 'PENDING' ? (
          <>
            <View style={{ height: '10rpx' }} />
            <Text className="muted">审核中：暂不可修改内容。</Text>
          </>
        ) : null}
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">基础信息</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">标题*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={title} onChange={setTitle} placeholder="例如：寻求电池热管理相关专利许可" maxLength={200} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">摘要（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishTextArea value={summary} onChange={setSummary} placeholder="一句话描述需求重点（建议 200 字以内）" maxLength={2000} disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">需求详情*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishTextArea value={description} onChange={setDescription} placeholder="背景/痛点/期望方案/指标…" maxLength={2000} disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">技术领域/关键词*</Text>
        <View style={{ height: '8rpx' }} />
        <TagInput value={keywords} onChange={setKeywords} max={30} disabled={!canEdit} placeholder="输入关键词后点击添加" />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">预算与合作</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">预算类型</Text>
        <View style={{ height: '8rpx' }} />
        <View className="row" style={{ gap: '12rpx' }}>
          {[
            ['NEGOTIABLE', '面议'],
            ['FIXED', '固定'],
          ].map(([value, label]) => (
            <View
              key={value}
              className={`chip ${budgetType === (value as PriceType) ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                setBudgetType(value as PriceType);
              }}
            >
              <Text>{label}</Text>
            </View>
          ))}
        </View>

        {budgetType === 'FIXED' ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="form-label">预算范围（元）</Text>
            <View style={{ height: '8rpx' }} />
            <View className="row" style={{ gap: '12rpx' }}>
              <View style={{ flex: 1 }}>
                <PublishInput value={budgetMinYuan} onChange={setBudgetMinYuan} placeholder="最小值" clearable disabled={!canEdit} />
              </View>
              <View style={{ flex: 1 }}>
                <PublishInput value={budgetMaxYuan} onChange={setBudgetMaxYuan} placeholder="最大值" clearable disabled={!canEdit} />
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">合作方式（可多选）</Text>
        <View style={{ height: '8rpx' }} />
        <View className="chip-row">
          {COOPERATION_MODES.map((it) => (
            <View
              key={it.mode}
              className={`chip ${cooperationModes.includes(it.mode) ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                toggleMode(it.mode);
              }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">交付周期（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <View className="chip-row">
          {DELIVERY_PERIODS.map((it) => (
            <View
              key={it.value}
              className={`chip ${deliveryPeriod === it.value ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                setDeliveryPeriod(it.value);
              }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
          <View
            className={`chip ${!deliveryPeriod ? 'chip-active' : ''}`}
            onClick={() => {
              if (!canEdit) return;
              setDeliveryPeriod('');
            }}
          >
            <Text>不填</Text>
          </View>
        </View>
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">地区与标签</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">地区（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={regionCode} onChange={setRegionCode} placeholder="例如：310000" clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">产业标签（可选；数据源：公共产业标签库）</Text>
        <View style={{ height: '8rpx' }} />
        <IndustryTagsPicker value={industryTags} max={8} onChange={setIndustryTags} disabled={!canEdit} />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">联系人信息</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">联系人称呼（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={contactName} onChange={setContactName} placeholder="例如：李老师" maxLength={50} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">职务/部门（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={contactTitle} onChange={setContactTitle} placeholder="例如：技术转移负责人" maxLength={100} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">联系方式（脱敏，可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput
          value={contactPhoneMasked}
          onChange={setContactPhoneMasked}
          placeholder="例如：138****8899"
          maxLength={30}
          clearable
          disabled={!canEdit}
        />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">封面与附件</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">封面图（可选；包含视频时建议设置）</Text>
        <View style={{ height: '10rpx' }} />
        {coverUrl ? <Image src={coverUrl} mode="aspectFill" style={{ width: '100%', height: '320rpx', borderRadius: '20rpx' }} /> : null}
        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx' }}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" disabled={!canEdit || uploading} loading={uploading} onClick={() => void setCover()}>
              上传封面
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="danger" fill="outline" disabled={!canEdit || !coverFileId} onClick={() => void removeCover()}>
              移除封面
            </Button>
          </View>
        </View>

        <View style={{ height: '14rpx' }} />
        <Text className="form-label">附件/媒体（图片/视频/文件）</Text>
        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
          <Button block={false} size="small" variant="ghost" disabled={!canEdit || uploading} onClick={() => void addImage()}>
            + 图片
          </Button>
          <Button block={false} size="small" variant="ghost" disabled={!canEdit || uploading} onClick={() => void addVideo()}>
            + 视频
          </Button>
          <Button block={false} size="small" variant="ghost" disabled={!canEdit || uploading} onClick={() => void addFile()}>
            + 文件
          </Button>
        </View>

        <View style={{ height: '10rpx' }} />
        {media.length ? (
          <View>
            {media.map((m) => (
              <View key={m.fileId} className="row-between" style={{ gap: '12rpx', marginBottom: '12rpx' }}>
                <View style={{ flex: 1, overflow: 'hidden' }}>
                  <Text className="text-strong clamp-1">
                    {m.type === 'IMAGE' ? '图片' : m.type === 'VIDEO' ? '视频' : '文件'}：{(m as any).fileName || m.fileId.slice(0, 8)}
                  </Text>
                  <View style={{ height: '4rpx' }} />
                  <Text className="muted clamp-1">{(m as any).url || '-'}</Text>
                </View>
                <Button block={false} size="small" variant="danger" fill="outline" disabled={!canEdit} onClick={() => void removeMedia(m.fileId)}>
                  删除
                </Button>
              </View>
            ))}
          </View>
        ) : (
          <Text className="muted">尚未上传附件（提交审核需至少 1 个）。</Text>
        )}
      </Surface>

      <View style={{ height: '24rpx' }} />

      <StickyBar>
        <View className="flex-1">
          <Button variant="ghost" disabled={saving || submitting || uploading} loading={saving} onClick={() => void saveDraft()}>
            {saving ? '保存中…' : '保存草稿'}
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" disabled={saving || submitting || uploading || !canEdit} loading={submitting} onClick={() => void submitForAudit()}>
            {submitting ? '提交中…' : '提交审核'}
          </Button>
        </View>
        {status === 'ACTIVE' ? (
          <View className="flex-1">
            <Button variant="danger" fill="outline" disabled={offShelving} loading={offShelving} onClick={() => void offShelf()}>
              下架
            </Button>
          </View>
        ) : null}
      </StickyBar>
    </View>
  );
}

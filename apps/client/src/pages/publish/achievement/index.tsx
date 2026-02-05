import { View, Text, Image, Video } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { ensureApproved, requireLogin } from '../../../lib/guard';
import { auditStatusLabel, contentStatusLabel, verificationTypeLabel } from '../../../lib/labels';
import { IndustryTagsPicker, TagInput } from '../../../ui/filters';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';

function resolveVideoPoster(url?: string | null): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

type Achievement = components['schemas']['Achievement'];
type AchievementCreateRequest = components['schemas']['AchievementCreateRequest'];
type AchievementUpdateRequest = components['schemas']['AchievementUpdateRequest'];
type CooperationMode = components['schemas']['CooperationMode'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];
type ContentMedia = components['schemas']['ContentMedia'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];
type UserVerification = components['schemas']['UserVerification'];
type VerificationType = components['schemas']['VerificationType'];

type UploadFileRes = components['schemas']['FileObject'] & { fileName?: string };

const MAX_IMAGE_COUNT = 9;
const MAX_VIDEO_COUNT = 1;
const MAX_FILE_COUNT = 3;
const MAX_TOTAL_MEDIA_COUNT = 12;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

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

const MATURITY_OPTIONS: Array<{ value: AchievementMaturity; label: string }> = [
  { value: 'CONCEPT', label: '概念' },
  { value: 'PROTOTYPE', label: '样机/原型' },
  { value: 'PILOT', label: '中试' },
  { value: 'MASS_PRODUCTION', label: '量产' },
  { value: 'COMMERCIALIZED', label: '已产业化' },
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

export default function PublishAchievementPage() {
  const router = useRouter();
  const initialAchievementId = useMemo(
    () => String(router?.params?.achievementId || ''),
    [router?.params?.achievementId],
  );

  const [achievementId, setAchievementId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [status, setStatus] = useState<ContentStatus | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [maturity, setMaturity] = useState<AchievementMaturity | ''>('');
  const [cooperationModes, setCooperationModes] = useState<CooperationMode[]>([]);
  const [publisherName, setPublisherName] = useState('');
  const [publisherType, setPublisherType] = useState<VerificationType | ''>('');

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
    if (!initialAchievementId) return;
    if (achievementId) return;

    (async () => {
      if (!ensureApproved()) return;
      try {
        const d = await apiGet<Achievement>(`/achievements/${initialAchievementId}`);
        setAchievementId(d.id);
        setAuditStatus(d.auditStatus || null);
        setStatus(d.status || null);

        setTitle(d.title || '');
        setSummary(d.summary || '');
        setDescription(d.description || '');
        setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
        setMaturity((d.maturity || '') as AchievementMaturity | '');
        setCooperationModes((d.cooperationModes || []) as CooperationMode[]);
        setRegionCode(d.regionCode || '');
        setIndustryTags(Array.isArray(d.industryTags) ? d.industryTags : []);
        if (d.publisher?.displayName) setPublisherName(d.publisher.displayName);
        if (d.publisher?.verificationType) setPublisherType(d.publisher.verificationType as VerificationType);

        setCoverFileId(d.coverFileId ?? null);
        setCoverUrl(d.coverUrl || null);
        setMedia(sortMedia((d.media || []) as ContentMedia[]));
      } catch (e: any) {
        toast(e?.message || '加载失败');
      }
    })();
  }, [achievementId, initialAchievementId]);

  const canEdit = auditStatus !== 'PENDING';

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!requireLogin()) return;
      try {
        const v = await apiGet<UserVerification>('/me/verification');
        if (!mounted) return;
        if (v?.displayName) setPublisherName((prev) => prev || v.displayName || '');
        if (v?.type) setPublisherType((prev) => prev || (v.type as VerificationType));
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
      setMedia((prev) => [
        ...prev,
        { fileId: f.id, type: 'IMAGE', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: f.fileName } as any,
      ]);
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
      setMedia((prev) => [
        ...prev,
        { fileId: f.id, type: 'VIDEO', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: f.fileName } as any,
      ]);
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
      setMedia((prev) => [
        ...prev,
        { fileId: f.id, type: 'FILE', sort: prev.length, url: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, fileName: name || f.fileName } as any,
      ]);
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

  const previewImages = useCallback(
    (currentUrl: string) => {
      const urls = media.filter((m) => m.type === 'IMAGE' && (m as any).url).map((m) => (m as any).url as string);
      if (!urls.length) return;
      void Taro.previewImage({ urls, current: currentUrl });
    },
    [media],
  );

  const buildCreate = useCallback(
    (mode: 'save' | 'submit'): AchievementCreateRequest | null => {
      const t = title.trim();
      const s = summary.trim();
      const keywordList = keywords.map((k) => k.trim()).filter(Boolean);
      if (mode === 'submit' && !t) {
        toast('请填写标题');
        return null;
      }
      if (mode === 'submit' && !s) {
        toast('请填写简介');
        return null;
      }
      if (mode === 'submit' && countMediaByType(media, 'IMAGE') < 1) {
        toast('请至少上传 1 张图片');
        return null;
      }
      if (mode === 'submit' && countMediaByType(media, 'VIDEO') > 0 && !coverFileId) {
        toast('包含视频时建议设置封面图');
        return null;
      }

      const req: AchievementCreateRequest = {
        title: t || '未命名成果',
        ...(s ? { summary: s } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(keywordList.length ? { keywords: keywordList } : {}),
        ...(maturity ? { maturity: maturity as AchievementMaturity } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(industryTags.length ? { industryTags } : {}),
        ...(cooperationModes.length ? { cooperationModes } : {}),
        ...(coverFileId ? { coverFileId } : {}),
        ...(media.length ? { media: media.map((m, idx) => ({ fileId: m.fileId, type: m.type, sort: idx })) } : {}),
      };

      return req;
    },
    [cooperationModes, coverFileId, description, industryTags, keywords, maturity, media, regionCode, summary, title],
  );

  const buildUpdate = useCallback(
    (mode: 'save' | 'submit'): AchievementUpdateRequest | null => {
      const req = buildCreate(mode);
      if (!req) return null;
      const { title: t, ...rest } = req as any;
      return { title: t, ...rest } as AchievementUpdateRequest;
    },
    [buildCreate],
  );

  const saveDraft = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    setSaving(true);
    try {
      let res: Achievement;
      if (!achievementId) {
        const req = buildCreate('save');
        if (!req) return;
        res = await apiPost<Achievement>('/achievements', req, { idempotencyKey: `demo-achievement-create-${Date.now()}` });
        setAchievementId(res.id);
      } else {
        const req = buildUpdate('save');
        if (!req) return;
        res = await apiPatch<Achievement>(`/achievements/${achievementId}`, req, { idempotencyKey: `demo-achievement-patch-${achievementId}` });
      }
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('草稿已保存', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [achievementId, buildCreate, buildUpdate, saving, submitting]);

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
      let id = achievementId;
      if (!id) {
        const req = buildCreate('submit');
        if (!req) return;
        const created = await apiPost<Achievement>('/achievements', req, { idempotencyKey: `demo-achievement-create-submit-${Date.now()}` });
        id = created.id;
        setAchievementId(created.id);
        setAuditStatus(created.auditStatus || null);
        setStatus(created.status || null);
      } else {
        const req = buildUpdate('submit');
        if (!req) return;
        const updated = await apiPatch<Achievement>(`/achievements/${id}`, req, { idempotencyKey: `demo-achievement-patch-submit-${id}` });
        setAuditStatus(updated.auditStatus || null);
        setStatus(updated.status || null);
      }

      const res = await apiPost<Achievement>(`/achievements/${id}/submit`, undefined, { idempotencyKey: `demo-achievement-submit-${id}` });
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已提交审核', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [achievementId, buildCreate, buildUpdate, saving, submitting]);

  const offShelf = useCallback(async () => {
    if (!achievementId) return;
    if (offShelving) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '下架成果',
      content: '下架后将不再对外展示，可在草稿中继续编辑。',
      confirmText: '下架',
      cancelText: '取消',
    });
    if (!ok) return;

    setOffShelving(true);
    try {
      const res = await apiPost<Achievement>(`/achievements/${achievementId}/off-shelf`, { reason: '发布方下架' }, { idempotencyKey: `demo-achievement-off-${achievementId}` });
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已下架', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    } finally {
      setOffShelving(false);
    }
  }, [achievementId, offShelving]);

  return (
    <View className="container has-sticky publish-achievement-page">
      <PageHeader back fallbackUrl="/pages/publish/index" title="发布：成果展示" brand={false} />
      <Spacer />

      <Surface>
        <Text className="text-strong">状态</Text>
        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
          <Text className="tag">{status ? contentStatusLabel(status) : '-'}</Text>
          <Text className={`tag ${auditStatus === 'APPROVED' ? 'tag-success' : auditStatus === 'REJECTED' ? 'tag-danger' : 'tag-warning'}`}>
            {auditStatus ? auditStatusLabel(auditStatus) : '-'}
          </Text>
          {achievementId ? <Text className="tag">ID：{achievementId.slice(0, 8)}</Text> : <Text className="tag">未创建</Text>}
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

        <Text className="form-label">所属单位*</Text>
        <View style={{ height: '8rpx' }} />
        <View className="row-between" style={{ gap: '12rpx', alignItems: 'center' }}>
          <Text className="text-strong">
            {publisherName || (publisherType ? verificationTypeLabel(publisherType) : '未获取认证主体')}
          </Text>
          {publisherType ? <Text className="tag tag-gold">{verificationTypeLabel(publisherType)}</Text> : null}
        </View>
        <View style={{ height: '6rpx' }} />
        <Text className="muted">由认证信息自动带出，不可手动修改。</Text>

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">标题*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={title} onChange={setTitle} placeholder="例如：储能材料成果转化" maxLength={200} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">简介*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishTextArea value={summary} onChange={setSummary} placeholder="应用场景/亮点/指标（建议 200 字以内）" maxLength={2000} disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">关键词（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <TagInput value={keywords} onChange={setKeywords} max={30} disabled={!canEdit} placeholder="输入关键词后点击添加" />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">详情（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishTextArea value={description} onChange={setDescription} placeholder="更多说明、参数、检测报告摘要等…" maxLength={5000} disabled={!canEdit} />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">成熟度与合作</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">成熟度（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <View className="chip-row">
          {MATURITY_OPTIONS.map((it) => (
            <View
              key={it.value}
              className={`chip ${maturity === it.value ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                setMaturity(it.value);
              }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
          <View
            className={`chip ${!maturity ? 'chip-active' : ''}`}
            onClick={() => {
              if (!canEdit) return;
              setMaturity('');
            }}
          >
            <Text>不填</Text>
          </View>
        </View>

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
        <Text className="form-label">附件/媒体（至少 1 张图片，可选视频/文件）</Text>
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
              <View key={m.fileId} style={{ marginBottom: '16rpx' }}>
                {m.type === 'IMAGE' && (m as any).url ? (
                  <View
                    onClick={() => {
                      void previewImages((m as any).url as string);
                    }}
                  >
                    <Image src={(m as any).url as string} mode="aspectFill" style={{ width: '100%', height: '320rpx', borderRadius: '20rpx' }} />
                  </View>
                ) : m.type === 'VIDEO' && (m as any).url ? (
                  <Video
                    src={(m as any).url as string}
                    controls
                    autoplay={false}
                    poster={resolveVideoPoster(coverUrl)}
                    style={{ width: '100%', height: '320rpx', borderRadius: '20rpx' }}
                  />
                ) : m.type === 'FILE' && (m as any).url ? (
                  <View className="row-between" style={{ gap: '12rpx' }}>
                    <View style={{ flex: 1, overflow: 'hidden' }}>
                      <Text className="text-strong clamp-1">{(m as any).fileName || '附件'}</Text>
                      <View style={{ height: '4rpx' }} />
                      <Text className="muted clamp-1">{(m as any).url as string}</Text>
                    </View>
                    <Button
                      block={false}
                      size="small"
                      variant="ghost"
                      onClick={() => {
                        Taro.setClipboardData({ data: (m as any).url as string });
                        toast('链接已复制', { icon: 'success' });
                      }}
                    >
                      复制链接
                    </Button>
                  </View>
                ) : (
                  <View className="row-between" style={{ gap: '12rpx' }}>
                    <Text className="muted clamp-1">附件：{m.fileId.slice(0, 8)}</Text>
                  </View>
                )}

                <View style={{ height: '10rpx' }} />
                <View className="row-between" style={{ gap: '12rpx' }}>
                  <Text className="muted clamp-1">
                    {m.type === 'IMAGE' ? '图片' : m.type === 'VIDEO' ? '视频' : '文件'}：{(m as any).fileName || m.fileId.slice(0, 8)}
                  </Text>
                  <Button block={false} size="small" variant="danger" fill="outline" disabled={!canEdit} onClick={() => void removeMedia(m.fileId)}>
                    删除
                  </Button>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text className="muted">尚未上传附件（提交审核需至少 1 张图片）。</Text>
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

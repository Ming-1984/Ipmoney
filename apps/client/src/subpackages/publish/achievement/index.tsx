import { Button as NativeButton, Image, Picker, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useUnload } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import publishLockedArt from '../../../assets/illustrations/publish-locked.png';
import iconUpload from '../../../assets/icons/icon-image-gray.svg';
import { API_BASE_URL } from '../../../constants';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { createFileTemporaryAccess } from '../../../lib/files';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { auditStatusLabel, contentStatusLabel } from '../../../lib/labels';
import { ensureRegionNamesReady, formatRegionPathNames, parseRegionPickerSelection, regionDisplayName, regionNameByCode } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { chooseImageFiles, chooseMessageFiles, uploadFileToApi } from '../../../lib/upload';
import { AccessGate } from '../../../ui/PageState';
import { ChipGroup, IndustryTagsPicker, type ChipOption } from '../../../ui/filters';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Input, TextArea, confirm, toast } from '../../../ui/nutui';

const WEAPP_DEBUG = process.env.NODE_ENV !== 'production' && process.env.TARO_ENV === 'weapp';

function reportWeappDebug(title: string, detail?: unknown) {
  if (!WEAPP_DEBUG) return;
  console.error(`[weapp-debug] ${title}`, detail);
}

type AchievementDraft = components['schemas']['AchievementEdit'];
type ContentMedia = components['schemas']['ContentMedia'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];
type CooperationMode = components['schemas']['CooperationMode'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];

type UploadedFile = {
  id: string;
  url?: string | null;
  localPath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  type?: string | null;
  sort?: number | null;
};

type AchievementMediaSource = 'image' | 'file';

async function enrichUploadedFile(file: UploadedFile): Promise<UploadedFile> {
  const fileId = String(file?.id || '').trim();
  if (!fileId) return file;
  try {
    const preview = await createFileTemporaryAccess(fileId, { scope: 'preview', expiresInSeconds: 600 });
    return {
      ...file,
      url: String(preview?.url || file.url || '').trim() || file.url || null,
    };
  } catch {
    return file;
  }
}

function buildActionErrorDetail(error: any) {
  if (!error) return 'unknown error';
  const detail = {
    message: error?.message || String(error),
    code: error?.code || '',
    statusCode: error?.statusCode || '',
    debug: error?.debug || null,
  };
  try {
    return JSON.stringify(detail);
  } catch {
    return detail.message;
  }
}

const MATURITY_OPTIONS: ChipOption<AchievementMaturity | ''>[] = [
  { value: '', label: '不限' },
  { value: 'CONCEPT', label: '概念验证' },
  { value: 'PROTOTYPE', label: '样机阶段' },
  { value: 'PILOT', label: '中试阶段' },
  { value: 'MASS_PRODUCTION', label: '量产阶段' },
  { value: 'COMMERCIALIZED', label: '已商业化' },
  { value: 'OTHER', label: '其他' },
];

const COOPERATION_OPTIONS: ChipOption<CooperationMode>[] = [
  { value: 'TRANSFER', label: '技术转让' },
  { value: 'TECH_CONSULTING', label: '技术咨询' },
  { value: 'COMMISSIONED_DEV', label: '委托开发' },
  { value: 'PLATFORM_CO_BUILD', label: '平台共建' },
];

const UNTITLED_ACHIEVEMENT_DRAFT_TITLE = '未命名成果草稿';

function isSubmittedAchievement(status?: ContentStatus | null, auditStatus?: AuditStatus | null): boolean {
  return status !== 'DRAFT' && (auditStatus === 'PENDING' || auditStatus === 'APPROVED' || auditStatus === 'REJECTED');
}

function splitList(input: string): string[] {
  return String(input || '')
    .split(/[\n,，;；]/)
    .map((text) => text.trim())
    .filter(Boolean);
}

function mergePlaceholderClass(extra?: string): string {
  return extra ? `publish-placeholder ${extra}` : 'publish-placeholder';
}

function mergePlaceholderStyle(extra?: string): string {
  const base = 'font-size:20rpx;color:#c0c4cc;';
  if (!extra) return base;
  return `${base}${extra}`;
}

function mergePublishClassName(className?: string): string {
  return className ? `publish-control ${className}` : 'publish-control';
}

function PublishInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={mergePublishClassName(props.className)}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

function PublishTextArea(props: React.ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...props}
      className={mergePublishClassName(props.className)}
      placeholderClass={mergePlaceholderClass(props.placeholderClass)}
      placeholderStyle={mergePlaceholderStyle(props.placeholderStyle)}
    />
  );
}

function toMediaInput(files: UploadedFile[]): ContentMedia[] {
  return files.map((file, index) => ({
    fileId: file.id,
    type: (file.type || 'IMAGE') as ContentMedia['type'],
    sort: typeof file.sort === 'number' ? file.sort : index,
  }));
}

function pickUploadedFileName(file: UploadedFile, index: number, fallback = '附件'): string {
  const name = String(file.fileName || '').trim();
  if (name) return name;
  const mime = String(file.mimeType || '').trim().toLowerCase();
  if (mime.startsWith('image/')) {
    const ext = mime.split('/')[1] || 'image';
    return `${fallback}-${index + 1}.${ext}`;
  }
  return `${fallback}-${index + 1}`;
}

function isUploadedImage(file: UploadedFile): boolean {
  const mime = String(file.mimeType || '').trim().toLowerCase();
  return file.type === 'IMAGE' || mime.startsWith('image/');
}

function resolveRenderableFileUrl(file: UploadedFile | null | undefined): string {
  if (!file) return '';
  const remoteUrl = String(file.url || '').trim();
  if (remoteUrl) return remoteUrl;
  return String(file.localPath || '').trim();
}

function formatUploadedFileSize(file: UploadedFile): string {
  return typeof file.sizeBytes === 'number' ? `${(file.sizeBytes / 1024).toFixed(0)}KB` : '';
}

export default function PublishAchievementPage() {
  const access = usePageAccess('approved-required');
  const initialAchievementId = useRouteUuidParam('achievementId') || '';
  const achievementRouteIdRef = useRef(initialAchievementId);
  const pageVisibleRef = useRef(true);
  const uploadPickerActiveRef = useRef(false);
  const uploadSeqRef = useRef(0);
  const saveSeqRef = useRef(0);
  const submitSeqRef = useRef(0);

  const [achievementId, setAchievementId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [contentStatus, setContentStatus] = useState<ContentStatus | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [maturity, setMaturity] = useState<AchievementMaturity | ''>('');
  const [cooperationModes, setCooperationModes] = useState<CooperationMode[]>([]);
  const [regionCode, setRegionCode] = useState<string | undefined>();
  const [regionName, setRegionName] = useState<string | undefined>();
  const [industryTags, setIndustryTags] = useState<string[]>([]);

  const [coverFile, setCoverFile] = useState<UploadedFile | null>(null);
  const [mediaFiles, setMediaFiles] = useState<UploadedFile[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const keywords = useMemo(() => splitList(keywordsInput), [keywordsInput]);
  const sanitizedIndustryTags = useMemo(() => sanitizeIndustryTagNames(industryTags), [industryTags]);

  useDidShow(() => {
    pageVisibleRef.current = true;
  });

  useDidHide(() => {
    if (uploadPickerActiveRef.current) return;
    pageVisibleRef.current = false;
    uploadSeqRef.current += 1;
    saveSeqRef.current += 1;
    submitSeqRef.current += 1;
    setUploading(false);
    setSaving(false);
    setSubmitting(false);
  });

  useUnload(() => {
    pageVisibleRef.current = false;
    uploadPickerActiveRef.current = false;
    uploadSeqRef.current += 1;
    saveSeqRef.current += 1;
    submitSeqRef.current += 1;
  });

  const resetForm = useCallback(() => {
    setAchievementId(null);
    setAuditStatus(null);
    setContentStatus(null);
    setSubmitted(false);
    setTitle('');
    setSummary('');
    setDescription('');
    setKeywordsInput('');
    setMaturity('');
    setCooperationModes([]);
    setRegionCode(undefined);
    setRegionName(undefined);
    setIndustryTags([]);
    setCoverFile(null);
    setMediaFiles([]);
  }, []);

  useEffect(() => {
    achievementRouteIdRef.current = initialAchievementId;
    saveSeqRef.current += 1;
    submitSeqRef.current += 1;
    if (!initialAchievementId) {
      resetForm();
      return;
    }
    resetForm();

    (async () => {
      if (!ensureApproved()) return;
      const targetAchievementId = initialAchievementId;
      try {
        const draft = await apiGet<AchievementDraft>(`/achievements/${targetAchievementId}`);
        if (achievementRouteIdRef.current !== targetAchievementId) return;

        setAchievementId(draft.id);
        setAuditStatus(draft.auditStatus || null);
        setContentStatus(draft.status || null);
        setSubmitted(isSubmittedAchievement(draft.status || null, draft.auditStatus || null));

        setTitle(draft.title || '');
        setSummary(draft.summary || '');
        setDescription(draft.description || '');
        setKeywordsInput((draft.keywords || []).join(', '));
        setMaturity((draft.maturity || '') as AchievementMaturity | '');
        setCooperationModes((draft.cooperationModes || []) as CooperationMode[]);
        setIndustryTags(sanitizeIndustryTagNames(draft.industryTags || []));

        if (draft.regionCode) {
          setRegionCode(draft.regionCode);
          try {
            await ensureRegionNamesReady();
            if (achievementRouteIdRef.current !== targetAchievementId) return;
            setRegionName(regionNameByCode(draft.regionCode) || undefined);
          } catch {
            if (achievementRouteIdRef.current !== targetAchievementId) return;
            setRegionName(undefined);
          }
        } else {
          setRegionCode(undefined);
          setRegionName(undefined);
        }

        if (draft.coverFileId || draft.coverUrl) {
          setCoverFile({
            id: draft.coverFileId || '',
            url: draft.coverUrl || null,
          });
        }

        const media = (draft.media || []).map((item: ContentMedia, index: number) => ({
          id: item.fileId,
          url: item.url || null,
          fileName: item.fileName || null,
          mimeType: item.mimeType || null,
          sizeBytes: item.sizeBytes || null,
          type: item.type,
          sort: typeof item.sort === 'number' ? item.sort : index,
        }));
        if (achievementRouteIdRef.current !== targetAchievementId) return;
        setMediaFiles(media);
      } catch (error: any) {
        if (achievementRouteIdRef.current !== targetAchievementId) return;
        toast(error?.message || '加载失败');
      }
    })();
  }, [initialAchievementId, resetForm]);

  useEffect(() => {
    if (access.state === 'ok') return;
    uploadSeqRef.current += 1;
    saveSeqRef.current += 1;
    submitSeqRef.current += 1;
    setUploading(false);
    setSaving(false);
    setSubmitting(false);
  }, [access.state]);

  const uploadCover = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return null;
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++uploadSeqRef.current;
    try {
      reportWeappDebug('成果封面上传入口已触发', { achievementId: targetAchievementId || null });
      uploadPickerActiveRef.current = true;
      const chosen = await chooseImageFiles({ count: 1 }).finally(() => {
        uploadPickerActiveRef.current = false;
      });
      reportWeappDebug('成果封面选择返回', {
        tempFileCount: chosen.length || 0,
        tempFilePath: chosen[0]?.path || '',
      });
      const filePath = String(chosen[0]?.path || '').trim();
      if (!filePath) return null;

      pageVisibleRef.current = true;
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      setUploading(true);
      const token = getToken();
      const { data: json, response } = await uploadFileToApi<UploadedFile>({
        url: `${API_BASE_URL}/files`,
        filePath,
        name: 'file',
        formData: { purpose: 'ACHIEVEMENT_COVER' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });
      reportWeappDebug('成果封面上传接口返回', {
        statusCode: response.statusCode,
        body: json,
      });
      if (!json.id) throw new Error('上传失败');
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      const nextFile = await enrichUploadedFile({ ...json, localPath: filePath });
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      setCoverFile(nextFile);
      toast('已上传', { icon: 'success' });
      return nextFile;
    } catch (error: any) {
      reportWeappDebug('成果封面上传失败', error?.message || error?.errMsg || error);
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      if (error?.errMsg?.includes('cancel')) return null;
      toast(error?.message || '上传失败');
      return null;
    } finally {
      if (seq === uploadSeqRef.current && pageVisibleRef.current && achievementRouteIdRef.current === targetAchievementId) {
        setUploading(false);
      }
    }
  }, [uploading]);

  const removeCover = useCallback(async () => {
    if (!coverFile) return;
    const ok = await confirm({ title: '移除封面', content: '确定移除封面？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setCoverFile(null);
  }, [coverFile]);

  const uploadMedia = useCallback(async (source: AchievementMediaSource) => {
    if (uploading) return;
    if (!ensureApproved()) return;
    const remain = 6 - mediaFiles.length;
    if (remain <= 0) {
      toast('最多上传 6 个附件');
      return;
    }
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++uploadSeqRef.current;
    try {
      reportWeappDebug('成果附件上传入口已触发', {
        achievementId: targetAchievementId || null,
        remain,
        source,
      });
      reportWeappDebug('chooseMessageFile available', {
        hasChooseMessageFile: typeof Taro.chooseMessageFile === 'function',
        env: Taro.getEnv(),
      });

      let selectedFiles: Array<{ path: string; name: string; type: 'IMAGE' | 'FILE' }> = [];
      uploadPickerActiveRef.current = true;
      if (source === 'image') {
        const chosen = await chooseImageFiles({ count: remain }).finally(() => {
          uploadPickerActiveRef.current = false;
        });
        reportWeappDebug('成果附件图片选择返回', {
          tempFileCount: chosen.length || 0,
          firstTempFilePath: chosen[0]?.path || '',
        });
        selectedFiles = chosen
          .map((file) => ({
            path: String(file.path || '').trim(),
            name: String(file.name || '').trim(),
            type: 'IMAGE' as const,
          }))
          .filter((file) => Boolean(file.path));
      } else {
        if (typeof Taro.chooseMessageFile !== 'function') {
          uploadPickerActiveRef.current = false;
          throw new Error('当前环境不支持从微信聊天记录选择文件，请在真机微信中重试');
        }
        const chosen = await chooseMessageFiles({
          count: remain,
          type: 'file',
          extension: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'],
        }).finally(() => {
          uploadPickerActiveRef.current = false;
        });
        reportWeappDebug('成果附件文件选择返回', {
          tempFileCount: chosen.length || 0,
          firstTempFilePath: chosen[0]?.path || '',
          firstTempFileName: chosen[0]?.name || '',
        });
        selectedFiles = chosen
          .map((file) => ({
            path: String(file.path || '').trim(),
            name: String(file.name || '').trim(),
            type: 'FILE' as const,
          }))
          .filter((file) => Boolean(file.path));
      }

      if (!selectedFiles.length) return;

      pageVisibleRef.current = true;
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      setUploading(true);
      const token = getToken();
      const uploaded: UploadedFile[] = [];
      for (const file of selectedFiles) {
        const { data: json, response } = await uploadFileToApi<UploadedFile>({
          url: `${API_BASE_URL}/files`,
          filePath: file.path,
          name: 'file',
          formData: { purpose: 'ACHIEVEMENT_MEDIA' },
          header: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          retry: 1,
        });
        reportWeappDebug('成果附件上传接口返回', {
          statusCode: response.statusCode,
          body: json,
        });
        if (!json.id) throw new Error(`${file.name || '附件'} 上传失败`);
        const nextFile = await enrichUploadedFile({
          ...json,
          localPath: file.path,
          fileName: file.name || json.fileName,
          type: file.type,
        });
        uploaded.push(nextFile);
      }

      if (!uploaded.length) throw new Error('未上传成功任何附件');
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      setMediaFiles((prev) => [...prev, ...uploaded]);
      toast('已上传', { icon: 'success' });
    } catch (error: any) {
      reportWeappDebug('成果附件上传失败', error?.message || error?.errMsg || error);
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      if (error?.errMsg?.includes('cancel')) return;
      toast(error?.message || '上传失败');
    } finally {
      if (seq === uploadSeqRef.current && pageVisibleRef.current && achievementRouteIdRef.current === targetAchievementId) {
        setUploading(false);
      }
    }
  }, [mediaFiles.length, uploading]);

  const openMediaFile = useCallback((file: UploadedFile) => {
    const renderUrl = resolveRenderableFileUrl(file);
    if (!renderUrl) return;
    if (isUploadedImage(file)) {
      void Taro.previewImage({ urls: [renderUrl] });
      return;
    }
    void Taro.setClipboardData({ data: renderUrl });
    toast('链接已复制', { icon: 'success' });
  }, []);

  const removeMedia = useCallback(async (file: UploadedFile) => {
    const ok = await confirm({ title: '移除附件', content: '确定移除该附件？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setMediaFiles((prev) => prev.filter((item) => item.id !== file.id));
  }, []);

  const buildPayload = useCallback((options?: { titleFallback?: string }) => {
    return {
      title: title.trim() || options?.titleFallback || '',
      summary: summary.trim() || undefined,
      description: description.trim() || undefined,
      keywords,
      maturity: maturity || undefined,
      cooperationModes,
      regionCode: regionCode || undefined,
      industryTags: sanitizedIndustryTags,
      coverFileId: coverFile?.id || undefined,
      media: toMediaInput(mediaFiles),
    };
  }, [cooperationModes, coverFile, description, keywords, maturity, mediaFiles, regionCode, sanitizedIndustryTags, summary, title]);

  const saveDraft = useCallback(async (mode: 'save' | 'submit' = 'save'): Promise<AchievementDraft | null> => {
    if (!ensureApproved()) return null;
    if (mode === 'submit' && !title.trim()) {
      toast('请填写成果名称');
      return null;
    }
    if (saving) {
      toast('正在保存，请稍候');
      return null;
    }
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++saveSeqRef.current;
    setSaving(true);
    try {
      const payload = buildPayload({ titleFallback: mode === 'save' ? UNTITLED_ACHIEVEMENT_DRAFT_TITLE : undefined });
      if (!achievementId) {
        const created = await apiPost<AchievementDraft>('/achievements', payload, {
          idempotencyKey: `ach-create-${Date.now()}`,
        });
        if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
        setAchievementId(created.id);
        achievementRouteIdRef.current = created.id;
        setAuditStatus(created.auditStatus || null);
        setContentStatus(created.status || null);
        toast('草稿已保存，可在草稿箱查看', { icon: 'success' });
        return created;
      }

      const updated = await apiPatch<AchievementDraft>(`/achievements/${achievementId}`, payload, {
        idempotencyKey: `ach-update-${achievementId}`,
      });
      if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      setAuditStatus(updated.auditStatus || null);
      setContentStatus(updated.status || null);
      toast('草稿已保存，可在草稿箱查看', { icon: 'success' });
      return updated;
    } catch (error: any) {
      reportWeappDebug('成果保存失败详情', buildActionErrorDetail(error));
      if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      toast(error?.message || '保存失败');
      return null;
    } finally {
      if (seq === saveSeqRef.current && pageVisibleRef.current && achievementRouteIdRef.current === targetAchievementId) {
        setSaving(false);
      }
    }
  }, [achievementId, buildPayload, saving, title]);

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!ensureApproved()) return;
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++submitSeqRef.current;
    setSubmitting(true);
    try {
      const saved = await saveDraft('submit');
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      const id = saved?.id || achievementId || achievementRouteIdRef.current || null;
      if (!id) return;
      await apiPost(`/achievements/${id}/submit`, {}, { idempotencyKey: `ach-submit-${id}` });
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      setSubmitted(true);
      toast('已提交审核', { icon: 'success' });
    } catch (error: any) {
      reportWeappDebug('成果提交失败详情', buildActionErrorDetail(error));
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      toast(error?.message || '提交失败');
    } finally {
      if (seq === submitSeqRef.current && pageVisibleRef.current && achievementRouteIdRef.current === targetAchievementId) {
        setSubmitting(false);
      }
    }
  }, [achievementId, saveDraft, submitting]);

  return (
    <View className="container publish-achievement-page">
      {access.state !== 'ok' ? (
        <View className="page-locked">
          {access.state === 'need-login' ? (
            <View className="publish-locked">
              <Image className="publish-locked-ill" src={publishLockedArt} mode="aspectFit" />
              <Text className="publish-locked-text">登录 IPMONEY 后即可发布成果展示</Text>
            </View>
          ) : (
            <AccessGate access={access} />
          )}
        </View>
      ) : (
        <View>
          <PageHeader title="发布专利成果" subtitle="成果展示面向全平台可见" />
          <Spacer />

          <View className="publish-form">
            <Surface className="publish-card">
              <Text className="publish-section-title">成果信息</Text>
              <View className="form-field">
                <Text className="form-label">成果名称</Text>
                <PublishInput
                  value={title}
                  onChange={setTitle}
                  placeholder="填写成果名称"
                  className="publish-input"
                  data-testid="achievement-title"
                />
              </View>
              <View className="form-field">
                <Text className="form-label">成果简介</Text>
                <PublishInput value={summary} onChange={setSummary} placeholder="一句话介绍成果亮点" className="publish-input" />
              </View>
              <View className="form-field">
                <Text className="form-label">成果详情</Text>
                <PublishTextArea
                  value={description}
                  onChange={setDescription}
                  placeholder="描述应用场景、技术优势与合作方式"
                  className="publish-textarea"
                  maxLength={5000}
                  showCount
                />
              </View>
            </Surface>

            <Surface className="publish-card">
              <Text className="publish-section-title">成熟度与合作</Text>
              <View className="form-field">
                <Text className="form-label">成熟度</Text>
                <ChipGroup value={maturity} options={MATURITY_OPTIONS} onChange={(value) => setMaturity(value as AchievementMaturity | '')} />
              </View>
              <View className="form-field">
                <Text className="form-label">合作方式</Text>
                <ChipGroup
                  multiple
                  value={cooperationModes}
                  options={COOPERATION_OPTIONS}
                  onChange={(next) => setCooperationModes(next as CooperationMode[])}
                />
              </View>
            </Surface>

            <Surface className="publish-card">
              <Text className="publish-section-title">区域与标签</Text>
              <View className="form-field">
                <Text className="form-label">所在地区</Text>
                <Picker
                  mode="region"
                  level="region"
                  onChange={(event) => {
                    const parsed = parseRegionPickerSelection(event);
                    if (!parsed) {
                      toast('地区读取失败，请重试');
                      return;
                    }
                    setRegionCode(parsed.code);
                    setRegionName(formatRegionPathNames(parsed.pathNames, parsed.name));
                  }}
                >
                  <View className="form-select">
                    <Text className={regionCode ? 'form-select-value' : 'form-select-placeholder'}>
                      {regionDisplayName(regionCode, regionName, '请选择地区')}
                    </Text>
                    <Text className="form-select-arrow">▾</Text>
                  </View>
                </Picker>
              </View>
              <View className="form-field">
                <Text className="form-label">行业标签（关键词）</Text>
                <IndustryTagsPicker value={industryTags} onChange={setIndustryTags} max={6} />
              </View>
              <View className="form-field">
                <PublishInput
                  value={keywordsInput}
                  onChange={setKeywordsInput}
                  placeholder="用逗号分隔，如 AI, 新能源"
                  className="publish-input"
                />
              </View>
            </Surface>

            <Surface className="publish-card">
              <Text className="publish-section-title">封面与材料</Text>
              <View className="form-field">
                <Text className="form-label">成果封面</Text>
                {resolveRenderableFileUrl(coverFile) ? (
                  <View className="upload-preview">
                    <Image className="upload-preview-img" src={resolveRenderableFileUrl(coverFile)} mode="aspectFill" />
                    <View className="upload-preview-actions">
                      <NativeButton className="upload-preview-action-btn upload-preview-action-btn-ghost" onClick={() => void uploadCover()}>
                        重新上传
                      </NativeButton>
                      <NativeButton className="upload-preview-action-btn upload-preview-action-btn-ghost" onClick={removeCover}>
                        移除
                      </NativeButton>
                    </View>
                  </View>
                ) : (
                  <View className="upload-actions">
                    <NativeButton
                      className="upload-trigger upload-trigger-single"
                      disabled={uploading}
                      data-testid="achievement-upload-cover"
                      onClick={() => void uploadCover()}
                    >
                      <Image className="upload-icon" src={iconUpload} svg mode="aspectFit" />
                      <Text className="upload-title">{uploading ? '上传中...' : '选择封面图片'}</Text>
                      <Text className="upload-subtitle">从微信聊天记录选择封面图片</Text>
                    </NativeButton>
                  </View>
                )}
              </View>

              <View className="form-field">
                <Text className="form-label">附件资料</Text>
                <Text className="form-hint">最多上传 6 个附件，支持图片和常见文档文件</Text>
                <View className="upload-actions">
                  <NativeButton
                    className="upload-trigger"
                    disabled={uploading}
                    data-testid="achievement-upload-image"
                    onClick={() => void uploadMedia('image')}
                  >
                    <Image className="upload-icon" src={iconUpload} svg mode="aspectFit" />
                    <Text className="upload-title">{uploading ? '上传中...' : '选择图片上传'}</Text>
                    <Text className="upload-subtitle">从微信聊天记录选择图片</Text>
                  </NativeButton>
                  <NativeButton
                    className="upload-trigger"
                    disabled={uploading}
                    data-testid="achievement-upload-file"
                    onClick={() => void uploadMedia('file')}
                  >
                    <Image className="upload-icon" src={iconUpload} svg mode="aspectFit" />
                    <Text className="upload-title">{uploading ? '上传中...' : '选择文件上传'}</Text>
                    <Text className="upload-subtitle">从微信聊天记录选择 PDF、Word、Excel、PPT</Text>
                  </NativeButton>
                </View>
                {mediaFiles.length ? (
                  <View className="upload-list">
                    {mediaFiles.map((file, index) => (
                      <View key={file.id} className="upload-item" onClick={() => openMediaFile(file)}>
                        {isUploadedImage(file) && resolveRenderableFileUrl(file) ? (
                          <Image className="upload-item-cover" src={resolveRenderableFileUrl(file)} mode="aspectFill" />
                        ) : (
                          <Image className="upload-item-icon" src={iconUpload} svg mode="aspectFit" />
                        )}
                        <View className="upload-item-info">
                          <Text className="upload-item-title">{pickUploadedFileName(file, index)}</Text>
                          {formatUploadedFileSize(file) ? <Text className="upload-item-desc">{formatUploadedFileSize(file)}</Text> : null}
                        </View>
                        <NativeButton
                          className="upload-item-remove-btn upload-item-remove-btn-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeMedia(file);
                          }}
                        >
                          删除
                        </NativeButton>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Surface>

            <Surface className="publish-card">
              <View className="form-row form-row-split">
                <View className="form-row-split-item">
                  <View
                    className={`publish-action-btn publish-action-ghost ${saving ? 'is-disabled' : ''}`}
                    data-testid="achievement-save-draft"
                    hoverClass={saving ? 'none' : 'publish-action-btn-hover'}
                    onClick={() => {
                      if (saving) return;
                      void saveDraft();
                    }}
                  >
                    {saving ? '保存中...' : '保存草稿'}
                  </View>
                </View>
                <View className="form-row-split-item">
                  <View
                    className={`publish-action-btn publish-action-primary ${submitting ? 'is-disabled' : ''}`}
                    data-testid="achievement-submit"
                    hoverClass={submitting ? 'none' : 'publish-action-btn-hover'}
                    onClick={() => {
                      if (submitting) return;
                      void submit();
                    }}
                  >
                    {submitting ? '提交中...' : submitted ? '重新提交' : '提交审核'}
                  </View>
                </View>
              </View>
              {auditStatus ? <Text className="form-hint">当前审核状态：{auditStatusLabel(auditStatus)}</Text> : null}
              {contentStatus ? <Text className="form-hint">当前上架状态：{contentStatusLabel(contentStatus)}</Text> : null}
            </Surface>
          </View>
        </View>
      )}
    </View>
  );
}

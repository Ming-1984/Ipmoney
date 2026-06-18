import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL } from '../../../constants';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { ensureApproved, usePageAccess } from '../../../lib/guard';
import { sanitizeIndustryTagNames } from '../../../lib/industryTags';
import { auditStatusLabel, contentStatusLabel } from '../../../lib/labels';
import { openRegionPickerPage } from '../../../lib/regionPicker';
import { ensureRegionNamesReady, regionDisplayName, regionNameByCode } from '../../../lib/regions';
import { useRouteUuidParam } from '../../../lib/routeParams';
import { uploadWithRetry } from '../../../lib/upload';
import type { ChipOption } from '../../../ui/filters';
import { ChipGroup, IndustryTagsPicker } from '../../../ui/filters';
import { PageHeader, Spacer, Surface } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';
import { AccessGate } from '../../../ui/PageState';
import publishLockedArt from '../../../assets/illustrations/publish-locked.png';
import iconUpload from '../../../assets/icons/icon-image-gray.svg';

type AchievementDraft = components['schemas']['AchievementEdit'];
type ContentMedia = components['schemas']['ContentMedia'];
type AchievementMaturity = components['schemas']['AchievementMaturity'];
type CooperationMode = components['schemas']['CooperationMode'];
type AuditStatus = components['schemas']['AuditStatus'];
type ContentStatus = components['schemas']['ContentStatus'];

type UploadedFile = {
  id: string;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  type?: string | null;
  sort?: number | null;
};

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

function splitList(input: string): string[] {
  return input
    .split(/[\n,，、]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toMediaInput(files: UploadedFile[]): ContentMedia[] {
  return files.map((file, index) => ({
    fileId: file.id,
    type: (file.type || 'IMAGE') as ContentMedia['type'],
    sort: typeof file.sort === 'number' ? file.sort : index,
  }));
}

export default function PublishAchievementPage() {
  const access = usePageAccess('approved-required');
  const initialAchievementId = useRouteUuidParam('achievementId');
  const achievementRouteIdRef = useRef(initialAchievementId);
  const pageVisibleRef = useRef(true);
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
    pageVisibleRef.current = false;
    uploadSeqRef.current += 1;
    saveSeqRef.current += 1;
    submitSeqRef.current += 1;
    setUploading(false);
    setSaving(false);
    setSubmitting(false);
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
        const d = await apiGet<AchievementDraft>(`/achievements/${targetAchievementId}`);
        if (achievementRouteIdRef.current !== targetAchievementId) return;
        setAchievementId(d.id);
        setAuditStatus(d.auditStatus || null);
        setContentStatus(d.status || null);
        setSubmitted(d.auditStatus === 'PENDING' || d.auditStatus === 'APPROVED' || d.auditStatus === 'REJECTED');

        setTitle(d.title || '');
        setSummary(d.summary || '');
        setDescription(d.description || '');
        setKeywordsInput((d.keywords || []).join(', '));
        setMaturity((d.maturity || '') as AchievementMaturity | '');
        setCooperationModes((d.cooperationModes || []) as CooperationMode[]);
        setIndustryTags(sanitizeIndustryTagNames(d.industryTags || []));

        if (d.regionCode) {
          setRegionCode(d.regionCode);
          try {
            await ensureRegionNamesReady();
            if (achievementRouteIdRef.current !== targetAchievementId) return;
            setRegionName(regionNameByCode(d.regionCode) || undefined);
          } catch {
            if (achievementRouteIdRef.current !== targetAchievementId) return;
            setRegionName(undefined);
          }
        } else {
          setRegionCode(undefined);
          setRegionName(undefined);
        }

        if (d.coverFileId || d.coverUrl) {
          setCoverFile({ id: d.coverFileId || '', url: d.coverUrl || null });
        }
        const media = (d.media || []).map((m: ContentMedia, index: number) => ({
          id: m.fileId,
          url: m.url || null,
          fileName: m.fileName || null,
          mimeType: m.mimeType || null,
          sizeBytes: m.sizeBytes || null,
          type: m.type,
          sort: typeof m.sort === 'number' ? m.sort : index,
        }));
        if (achievementRouteIdRef.current !== targetAchievementId) return;
        setMediaFiles(media);
      } catch (e: any) {
        if (achievementRouteIdRef.current !== targetAchievementId) return;
        toast(e?.message || '加载失败');
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
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      if (!filePath) return;
      const token = getToken();
      const uploadRes = await uploadWithRetry({
        url: `${API_BASE_URL}/files`,
        filePath,
        name: 'file',
        formData: { purpose: 'ACHIEVEMENT_COVER' },
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        retry: 1,
      });
      const json = JSON.parse(String(uploadRes.data || '{}')) as UploadedFile;
      if (!json.id) throw new Error('上传失败');
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      setCoverFile({ ...json });
      toast('已上传', { icon: 'success' });
    } catch (e: any) {
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
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

  const uploadMedia = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    const remain = Math.max(1, 6 - mediaFiles.length);
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++uploadSeqRef.current;
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: remain, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePaths = chosen?.tempFilePaths || [];
      if (!filePaths.length) return;
      const token = getToken();
      const uploaded: UploadedFile[] = [];
      for (const filePath of filePaths) {
        const uploadRes = await uploadWithRetry({
          url: `${API_BASE_URL}/files`,
          filePath,
          name: 'file',
          formData: { purpose: 'ACHIEVEMENT_MEDIA' },
          header: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          retry: 1,
        });
        const json = JSON.parse(String(uploadRes.data || '{}')) as UploadedFile;
        if (json.id) uploaded.push({ ...json, type: 'IMAGE' });
      }
      if (uploaded.length) {
        if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
        setMediaFiles((prev) => [...prev, ...uploaded]);
        toast('已上传', { icon: 'success' });
      }
    } catch (e: any) {
      if (seq !== uploadSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      if (seq === uploadSeqRef.current && pageVisibleRef.current && achievementRouteIdRef.current === targetAchievementId) {
        setUploading(false);
      }
    }
  }, [mediaFiles.length, uploading]);

  const removeMedia = useCallback(async (file: UploadedFile) => {
    const ok = await confirm({ title: '移除附件', content: '确定移除该附件？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setMediaFiles((prev) => prev.filter((x) => x.id !== file.id));
  }, []);

  const buildPayload = useCallback(() => {
    return {
      title: title.trim(),
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
  }, [title, summary, description, keywords, maturity, cooperationModes, regionCode, sanitizedIndustryTags, coverFile, mediaFiles]);

  const saveDraft = useCallback(async (): Promise<AchievementDraft | null> => {
    if (!ensureApproved()) return null;
    if (!title.trim()) {
      toast('请填写成果名称');
      return null;
    }
    if (saving) return null;
    const targetAchievementId = achievementRouteIdRef.current || '';
    const seq = ++saveSeqRef.current;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (!achievementId) {
        const created = await apiPost<AchievementDraft>('/achievements', payload, {
          idempotencyKey: `ach-create-${Date.now()}`,
        });
        if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
        setAchievementId(created.id);
        achievementRouteIdRef.current = created.id;
        setAuditStatus(created.auditStatus || null);
        setContentStatus(created.status || null);
        toast('已保存', { icon: 'success' });
        return created;
      } else {
        const updated = await apiPatch<AchievementDraft>(`/achievements/${achievementId}`, payload, {
          idempotencyKey: `ach-update-${achievementId}`,
        });
        if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
        setAuditStatus(updated.auditStatus || null);
        setContentStatus(updated.status || null);
        toast('已保存', { icon: 'success' });
        return updated;
      }
    } catch (e: any) {
      if (seq !== saveSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return null;
      toast(e?.message || '保存失败');
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
      const saved = await saveDraft();
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      const id = saved?.id || achievementId || achievementRouteIdRef.current || null;
      if (!id) return;
      await apiPost(`/achievements/${id}/submit`, {}, { idempotencyKey: `ach-submit-${id}` });
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      setSubmitted(true);
      toast('已提交审核', { icon: 'success' });
    } catch (e: any) {
      if (seq !== submitSeqRef.current || !pageVisibleRef.current || achievementRouteIdRef.current !== targetAchievementId) return;
      toast(e?.message || '提交失败');
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
              <Text className="publish-locked-text">登录IPMONEY，发布成果展示！</Text>
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
                <Input
                  value={title}
                  onChange={setTitle}
                  placeholder="填写成果名称"
                  className="publish-input"
                />
              </View>
              <View className="form-field">
                <Text className="form-label">成果简介</Text>
                <Input
                  value={summary}
                  onChange={setSummary}
                  placeholder="一句话介绍成果亮点"
                  className="publish-input"
                />
              </View>
              <View className="form-field">
                <Text className="form-label">成果详情</Text>
                <TextArea
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
                <ChipGroup value={maturity} options={MATURITY_OPTIONS} onChange={(v) => setMaturity(v as AchievementMaturity | '')} />
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
                <View
                  className="form-row"
                  onClick={() =>
                    openRegionPickerPage(({ code, name }) => {
                      setRegionCode(code);
                      setRegionName(name);
                    })
                  }
                >
                  <Text className={regionCode ? 'form-select-value' : 'form-select-placeholder'}>
                    {regionDisplayName(regionCode, regionName, '请选择地区')}
                  </Text>
                </View>
              </View>
              <View className="form-field">
                <Text className="form-label">行业标签</Text>
                <IndustryTagsPicker value={industryTags} onChange={setIndustryTags} max={6} />
              </View>
              <View className="form-field">
                <Text className="form-label">关键词</Text>
                <Input
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
                {coverFile?.url ? (
                  <View className="upload-preview">
                    <Image className="upload-preview-img" src={coverFile.url} mode="aspectFill" />
                    <Button size="small" variant="ghost" onClick={removeCover}>
                      移除
                    </Button>
                  </View>
                ) : (
                  <View className="upload-box" onClick={uploadCover}>
                    <Image className="upload-icon" src={iconUpload} svg mode="aspectFit" />
                    <Text className="upload-title">{uploading ? '上传中' : '上传封面'}</Text>
                    <Text className="upload-subtitle">图片格式</Text>
                  </View>
                )}
              </View>

              <View className="form-field">
                <Text className="form-label">附件资料</Text>
                <View className="upload-box" onClick={uploadMedia}>
                  <Image className="upload-icon" src={iconUpload} svg mode="aspectFit" />
                  <Text className="upload-title">{uploading ? '上传中' : '上传附件'}</Text>
                  <Text className="upload-subtitle">最多 6 张图片</Text>
                </View>
                {mediaFiles.length ? (
                  <View className="upload-list">
                    {mediaFiles.map((file) => (
                      <View key={file.id} className="upload-item">
                        {file.url ? (
                          <Image className="upload-item-cover" src={file.url} mode="aspectFill" />
                        ) : (
                          <Image className="upload-item-icon" src={iconUpload} svg mode="aspectFit" />
                        )}
                        <View className="upload-item-info">
                          <Text className="upload-item-title">{file.fileName || '附件'}</Text>
                          <Text className="upload-item-desc">{file.mimeType || 'image'}</Text>
                        </View>
                        <Text className="upload-item-remove" onClick={() => removeMedia(file)}>
                          移除
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Surface>

            <Surface className="publish-card">
              <View className="form-row form-row-split">
                <Button variant="ghost" onClick={saveDraft} disabled={saving}>
                  保存草稿
                </Button>
                <Button variant="primary" onClick={submit} disabled={submitting}>
                  {submitted ? '重新提交' : '提交审核'}
                </Button>
              </View>
              {auditStatus ? (
                <Text className="form-hint">当前审核状态：{auditStatusLabel(auditStatus)}</Text>
              ) : null}
              {contentStatus ? (
                <Text className="form-hint">当前上架状态：{contentStatusLabel(contentStatus)}</Text>
              ) : null}
            </Surface>
          </View>
        </View>
      )}
    </View>
  );
}

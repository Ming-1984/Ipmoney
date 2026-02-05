import { View, Text, Image, Video } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './index.scss';

import type { components } from '@ipmoney/api-types';

import { API_BASE_URL, STORAGE_KEYS } from '../../../constants';
import { getToken } from '../../../lib/auth';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';
import { ensureApproved, requireLogin } from '../../../lib/guard';
import { auditStatusLabel, artworkStatusLabel, verificationTypeLabel } from '../../../lib/labels';
import { fenToYuan } from '../../../lib/money';
import { PageHeader, Spacer, StickyBar, Surface } from '../../../ui/layout';
import { Button, Input, TextArea, confirm, toast } from '../../../ui/nutui';

function resolveVideoPoster(url?: string | null): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

type Artwork = components['schemas']['Artwork'];
type ArtworkCreateRequest = components['schemas']['ArtworkCreateRequest'];
type ArtworkUpdateRequest = components['schemas']['ArtworkUpdateRequest'];
type ArtworkCategory = components['schemas']['ArtworkCategory'];
type CalligraphyScript = components['schemas']['CalligraphyScript'];
type PaintingGenre = components['schemas']['PaintingGenre'];
type PriceType = components['schemas']['PriceType'];
type AuditStatus = components['schemas']['AuditStatus'];
type ArtworkStatus = components['schemas']['ArtworkStatus'];
type ContentMedia = components['schemas']['ContentMedia'];
type UserVerification = components['schemas']['UserVerification'];
type VerificationType = components['schemas']['VerificationType'];
type FileObject = components['schemas']['FileObject'];

type UploadFileRes = FileObject & { fileName?: string };
type UploadedFile = Pick<UploadFileRes, 'id'> & Partial<Omit<UploadFileRes, 'id'>>;

const MAX_IMAGE_COUNT = 9;
const MAX_VIDEO_COUNT = 1;
const MAX_FILE_COUNT = 3;
const MAX_TOTAL_MEDIA_COUNT = 12;
const MAX_CERT_COUNT = 5;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CERT_BYTES = 10 * 1024 * 1024;

const CATEGORY_OPTIONS = [
  { value: 'CALLIGRAPHY', label: '书法' },
  { value: 'PAINTING', label: '绘画' },
] as const;

const CALLIGRAPHY_OPTIONS = [
  { value: 'KAISHU', label: '楷书' },
  { value: 'XINGSHU', label: '行书' },
  { value: 'CAOSHU', label: '草书' },
  { value: 'LISHU', label: '隶书' },
  { value: 'ZHUANSHU', label: '篆书' },
] as const;

const PAINTING_OPTIONS = [
  { value: 'FIGURE', label: '人物' },
  { value: 'LANDSCAPE', label: '山水' },
  { value: 'BIRD_FLOWER', label: '花鸟' },
  { value: 'OTHER', label: '其他' },
] as const;

const PRICE_TYPE_OPTIONS = [
  { value: 'FIXED', label: '一口价' },
  { value: 'NEGOTIABLE', label: '面议' },
] as const;

function parseMoneyFen(input: string): number | null {
  const s = (input || '').trim().replace(/,/g, '');
  if (!s) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [a, bRaw] = s.split('.', 2);
  const b = (bRaw || '').padEnd(2, '0').slice(0, 2);
  const yuan = Number(a);
  const fen = Number(b);
  if (!Number.isFinite(yuan) || !Number.isFinite(fen)) return null;
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

function parseYear(input: string): number | null {
  const s = (input || '').trim();
  if (!s) return null;
  if (!/^\d{4}$/.test(s)) return null;
  const year = Number(s);
  return Number.isFinite(year) ? year : null;
}

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

export default function PublishArtworkPage() {
  const router = useRouter();
  const initialArtworkId = useMemo(() => String(router?.params?.artworkId || ''), [router?.params?.artworkId]);

  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [status, setStatus] = useState<ArtworkStatus | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ArtworkCategory | ''>('');
  const [calligraphyScript, setCalligraphyScript] = useState<CalligraphyScript | ''>('');
  const [paintingGenre, setPaintingGenre] = useState<PaintingGenre | ''>('');
  const [creatorName, setCreatorName] = useState('');
  const [creationDate, setCreationDate] = useState('');
  const [creationYear, setCreationYear] = useState('');
  const [certificateNo, setCertificateNo] = useState('');

  const [priceType, setPriceType] = useState<PriceType | ''>('');
  const [priceYuan, setPriceYuan] = useState('');
  const [depositYuan, setDepositYuan] = useState('');

  const [regionCode, setRegionCode] = useState('');
  const [material, setMaterial] = useState('');
  const [size, setSize] = useState('');
  const [description, setDescription] = useState('');

  const [publisherName, setPublisherName] = useState('');
  const [publisherType, setPublisherType] = useState<VerificationType | ''>('');

  const [certificateFiles, setCertificateFiles] = useState<UploadedFile[]>([]);
  const [coverFileId, setCoverFileId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<ContentMedia[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offShelving, setOffShelving] = useState(false);

  const canEdit = auditStatus !== 'PENDING';

  useEffect(() => {
    if (!initialArtworkId) return;
    if (artworkId) return;

    (async () => {
      if (!ensureApproved()) return;
      try {
        const d = await apiGet<Artwork>(`/artworks/${initialArtworkId}`);
        setArtworkId(d.id);
        setAuditStatus(d.auditStatus || null);
        setStatus(d.status || null);

        setTitle(d.title || '');
        setCategory((d.category || '') as ArtworkCategory | '');
        setCalligraphyScript((d.calligraphyScript || '') as CalligraphyScript | '');
        setPaintingGenre((d.paintingGenre || '') as PaintingGenre | '');
        setCreatorName(d.creatorName || '');
        setCreationDate(d.creationDate || '');
        setCreationYear(d.creationYear ? String(d.creationYear) : '');
        setCertificateNo(d.certificateNo || '');

        setPriceType((d.priceType || '') as PriceType | '');
        setPriceYuan(
          d.priceAmountFen !== undefined && d.priceAmountFen !== null
            ? fenToYuan(d.priceAmountFen, { empty: '' })
            : '',
        );
        setDepositYuan(
          d.depositAmountFen !== undefined && d.depositAmountFen !== null
            ? fenToYuan(d.depositAmountFen, { empty: '' })
            : '',
        );

        setRegionCode(d.regionCode || '');
        setMaterial(d.material || '');
        setSize(d.size || '');
        setDescription(d.description || '');

        setCertificateFiles(((d.certificateFileIds || []) as unknown as string[]).map((id) => ({ id: String(id) })));
        setCoverFileId(d.coverFileId ?? null);
        setCoverUrl(d.coverUrl || null);
        setMedia(sortMedia((d.media || []) as ContentMedia[]));
      } catch (e: any) {
        toast(e?.message || '加载失败');
      }
    })();
  }, [artworkId, initialArtworkId]);

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

  const openRegionPicker = useCallback(() => {
    try {
      Taro.navigateTo({
        url: '/pages/region-picker/index',
        success: (res) => {
          res.eventChannel.on('regionSelected', (payload: any) => {
            const code = String(payload?.code || '').trim();
            if (!code) return;
            setRegionCode(code);
          });
        },
      });
    } catch {
      // ignore
    }
  }, []);

  const setCover = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      const sizeBytes = chosen?.tempFiles?.[0]?.size;
      if (!filePath) return;
      if (typeof sizeBytes === 'number' && sizeBytes > MAX_IMAGE_BYTES) {
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

  const uploadCertificate = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (certificateFiles.length >= MAX_CERT_COUNT) {
      toast(`证书材料最多${MAX_CERT_COUNT}份`);
      return;
    }
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      const sizeBytes = chosen?.tempFiles?.[0]?.size;
      if (!filePath) return;
      if (typeof sizeBytes === 'number' && sizeBytes > MAX_CERT_BYTES) {
        toast(`证书文件过大（≤${Math.floor(MAX_CERT_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setCertificateFiles((prev) => [...prev, f]);
      toast('证书材料已上传', { icon: 'success' });
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return;
      toast(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [certificateFiles.length, uploading]);

  const removeCertificate = useCallback(async (f: UploadedFile) => {
    const ok = await confirm({ title: '移除材料', content: '确定移除该证书材料？', confirmText: '移除', cancelText: '取消' });
    if (!ok) return;
    setCertificateFiles((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  const addImage = useCallback(async () => {
    if (uploading) return;
    if (!ensureApproved()) return;
    if (media.length >= MAX_TOTAL_MEDIA_COUNT) {
      toast(`附件数量已达上限（≤${MAX_TOTAL_MEDIA_COUNT}）`);
      return;
    }
    if (countMediaByType(media, 'IMAGE') >= MAX_IMAGE_COUNT) {
      toast(`图片最多${MAX_IMAGE_COUNT}张`);
      return;
    }
    setUploading(true);
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      const filePath = chosen?.tempFilePaths?.[0];
      const sizeBytes = chosen?.tempFiles?.[0]?.size;
      if (!filePath) return;
      if (typeof sizeBytes === 'number' && sizeBytes > MAX_IMAGE_BYTES) {
        toast(`图片过大（≤${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [
        ...prev,
        {
          fileId: f.id,
          type: 'IMAGE',
          sort: prev.length,
          url: f.url,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          fileName: f.fileName,
        } as any,
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
      toast('视频最多1个');
      return;
    }
    setUploading(true);
    try {
      const chosen = await Taro.chooseVideo({ sourceType: ['album', 'camera'], compressed: true });
      const filePath = (chosen as any)?.tempFilePath as string | undefined;
      const sizeBytes = (chosen as any)?.size as number | undefined;
      if (!filePath) return;
      if (typeof sizeBytes === 'number' && sizeBytes > MAX_VIDEO_BYTES) {
        toast(`视频过大（≤${Math.floor(MAX_VIDEO_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [
        ...prev,
        {
          fileId: f.id,
          type: 'VIDEO',
          sort: prev.length,
          url: f.url,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          fileName: f.fileName,
        } as any,
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
      toast(`文件最多${MAX_FILE_COUNT}个`);
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
      const sizeBytes = chosen?.tempFiles?.[0]?.size as number | undefined;
      const name = chosen?.tempFiles?.[0]?.name as string | undefined;
      if (!filePath) return;
      if (typeof sizeBytes === 'number' && sizeBytes > MAX_FILE_BYTES) {
        toast(`文件过大（≤${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB）`);
        return;
      }
      const f = await uploadFile(filePath, { purpose: 'OTHER' });
      setMedia((prev) => [
        ...prev,
        {
          fileId: f.id,
          type: 'FILE',
          sort: prev.length,
          url: f.url,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          fileName: name || f.fileName,
        } as any,
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
    (mode: 'save' | 'submit'): ArtworkCreateRequest | null => {
      const t = title.trim();
      const creator = creatorName.trim();
      const dateValue = creationDate.trim();
      const yearValue = parseYear(creationYear);
      const priceAmountFen = priceType === 'FIXED' ? parseMoneyFen(priceYuan) : null;
      const depositAmountFen = parseMoneyFen(depositYuan);

      if (!category) {
        toast('请选择作品类别');
        return null;
      }
      if (!creator) {
        toast('请填写创作者');
        return null;
      }
      if (!priceType) {
        toast('请选择报价方式');
        return null;
      }
      if (priceType === 'FIXED' && priceAmountFen === null) {
        toast('请填写一口价金额');
        return null;
      }
      if (depositYuan.trim() && depositAmountFen === null) {
        toast('订金金额格式不正确');
        return null;
      }
      if (creationYear.trim() && yearValue === null) {
        toast('创作年份格式应为 4 位数字');
        return null;
      }
      if (mode === 'submit' && !t) {
        toast('请填写作品名称');
        return null;
      }
      if (mode === 'submit' && dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        toast('创作日期格式应为 YYYY-MM-DD');
        return null;
      }
      if (mode === 'submit' && countMediaByType(media, 'IMAGE') < 1 && !coverFileId) {
        toast('请至少上传 1 张作品图片或封面');
        return null;
      }

      const req: ArtworkCreateRequest = {
        title: t || '未命名书画作品',
        category: category as ArtworkCategory,
        creatorName: creator,
        priceType: priceType as PriceType,
        ...(category === 'CALLIGRAPHY' && calligraphyScript
          ? { calligraphyScript: calligraphyScript as CalligraphyScript }
          : {}),
        ...(category === 'PAINTING' && paintingGenre ? { paintingGenre: paintingGenre as PaintingGenre } : {}),
        ...(dateValue ? { creationDate: dateValue } : {}),
        ...(yearValue !== null ? { creationYear: yearValue } : {}),
        ...(certificateNo.trim() ? { certificateNo: certificateNo.trim() } : {}),
        ...(certificateFiles.length ? { certificateFileIds: certificateFiles.map((f) => f.id) } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(priceType === 'FIXED' && priceAmountFen !== null ? { priceAmountFen } : {}),
        ...(depositAmountFen !== null ? { depositAmountFen } : {}),
        ...(regionCode.trim() ? { regionCode: regionCode.trim() } : {}),
        ...(material.trim() ? { material: material.trim() } : {}),
        ...(size.trim() ? { size: size.trim() } : {}),
        ...(coverFileId ? { coverFileId } : {}),
        ...(media.length ? { media: media.map((m, idx) => ({ fileId: m.fileId, type: m.type, sort: idx })) } : {}),
      };

      return req;
    },
    [
      calligraphyScript,
      category,
      certificateFiles,
      certificateNo,
      coverFileId,
      creationDate,
      creationYear,
      creatorName,
      depositYuan,
      description,
      material,
      media,
      paintingGenre,
      priceType,
      priceYuan,
      regionCode,
      size,
      title,
    ],
  );

  const buildUpdate = useCallback(
    (mode: 'save' | 'submit'): ArtworkUpdateRequest | null => {
      const req = buildCreate(mode);
      if (!req) return null;
      const { title: nextTitle, ...rest } = req as any;
      return { title: nextTitle, ...rest } as ArtworkUpdateRequest;
    },
    [buildCreate],
  );

  const saveDraft = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    setSaving(true);
    try {
      let res: Artwork;
      if (!artworkId) {
        const req = buildCreate('save');
        if (!req) return;
        res = await apiPost<Artwork>('/artworks', req, { idempotencyKey: `demo-artwork-create-${Date.now()}` });
        setArtworkId(res.id);
      } else {
        const req = buildUpdate('save');
        if (!req) return;
        res = await apiPatch<Artwork>(`/artworks/${artworkId}`, req, { idempotencyKey: `demo-artwork-patch-${artworkId}` });
      }
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('草稿已保存', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [artworkId, buildCreate, buildUpdate, saving, submitting]);

  const submitForAudit = useCallback(async () => {
    if (saving || submitting) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '提交审核',
      content: '提交后将进入“审核中”，审核通过后对外展示。',
      confirmText: '提交',
      cancelText: '再检查一下',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      let id = artworkId;
      if (!id) {
        const req = buildCreate('submit');
        if (!req) return;
        const created = await apiPost<Artwork>('/artworks', req, { idempotencyKey: `demo-artwork-create-submit-${Date.now()}` });
        id = created.id;
        setArtworkId(created.id);
        setAuditStatus(created.auditStatus || null);
        setStatus(created.status || null);
      } else {
        const req = buildUpdate('submit');
        if (!req) return;
        const updated = await apiPatch<Artwork>(`/artworks/${id}`, req, { idempotencyKey: `demo-artwork-patch-submit-${id}` });
        setAuditStatus(updated.auditStatus || null);
        setStatus(updated.status || null);
      }

      const res = await apiPost<Artwork>(`/artworks/${id}/submit`, undefined, { idempotencyKey: `demo-artwork-submit-${id}` });
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已提交审核', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [artworkId, buildCreate, buildUpdate, saving, submitting]);

  const offShelf = useCallback(async () => {
    if (!artworkId) return;
    if (offShelving) return;
    if (!ensureApproved()) return;

    const ok = await confirm({
      title: '下架书画',
      content: '下架后将不再对外展示，可在草稿中继续编辑。',
      confirmText: '下架',
      cancelText: '取消',
    });
    if (!ok) return;

    setOffShelving(true);
    try {
      const res = await apiPost<Artwork>(
        `/artworks/${artworkId}/off-shelf`,
        { reason: '发布方下架' },
        { idempotencyKey: `demo-artwork-off-${artworkId}` },
      );
      setAuditStatus(res.auditStatus || null);
      setStatus(res.status || null);
      toast('已下架', { icon: 'success' });
    } catch (e: any) {
      toast(e?.message || '操作失败');
    } finally {
      setOffShelving(false);
    }
  }, [artworkId, offShelving]);

  return (
    <View className="container has-sticky publish-artwork-page">
      <PageHeader back fallbackUrl="/pages/publish/index" title="发布：书画专区" brand={false} />
      <Spacer />

      <Surface>
        <Text className="text-strong">状态</Text>
        <View style={{ height: '10rpx' }} />
        <View className="row" style={{ gap: '12rpx', flexWrap: 'wrap' }}>
          <Text className="tag">{status ? artworkStatusLabel(status) : '-'}</Text>
          <Text
            className={`tag ${
              auditStatus === 'APPROVED' ? 'tag-success' : auditStatus === 'REJECTED' ? 'tag-danger' : 'tag-warning'
            }`}
          >
            {auditStatus ? auditStatusLabel(auditStatus) : '-'}
          </Text>
          {artworkId ? <Text className="tag">ID：{artworkId.slice(0, 8)}</Text> : <Text className="tag">未创建</Text>}
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

        <Text className="form-label">所属主体</Text>
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
        <Text className="form-label">作品名称*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={title} onChange={setTitle} placeholder="例：山水四屏" maxLength={200} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">作品类别*</Text>
        <View style={{ height: '8rpx' }} />
        <View className="chip-row">
          {CATEGORY_OPTIONS.map((it) => (
            <View
              key={it.value}
              className={`chip ${category === it.value ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                setCategory(it.value);
                if (it.value === 'CALLIGRAPHY') setPaintingGenre('');
                if (it.value === 'PAINTING') setCalligraphyScript('');
              }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
          <View
            className={`chip ${!category ? 'chip-active' : ''}`}
            onClick={() => {
              if (!canEdit) return;
              setCategory('');
              setCalligraphyScript('');
              setPaintingGenre('');
            }}
          >
            <Text>不填</Text>
          </View>
        </View>

        {category === 'CALLIGRAPHY' ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="form-label">书体</Text>
            <View style={{ height: '8rpx' }} />
            <View className="chip-row">
              {CALLIGRAPHY_OPTIONS.map((it) => (
                <View
                  key={it.value}
                  className={`chip ${calligraphyScript === it.value ? 'chip-active' : ''}`}
                  onClick={() => {
                    if (!canEdit) return;
                    setCalligraphyScript(it.value);
                  }}
                >
                  <Text>{it.label}</Text>
                </View>
              ))}
              <View
                className={`chip ${!calligraphyScript ? 'chip-active' : ''}`}
                onClick={() => {
                  if (!canEdit) return;
                  setCalligraphyScript('');
                }}
              >
                <Text>不填</Text>
              </View>
            </View>
          </>
        ) : null}

        {category === 'PAINTING' ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="form-label">题材</Text>
            <View style={{ height: '8rpx' }} />
            <View className="chip-row">
              {PAINTING_OPTIONS.map((it) => (
                <View
                  key={it.value}
                  className={`chip ${paintingGenre === it.value ? 'chip-active' : ''}`}
                  onClick={() => {
                    if (!canEdit) return;
                    setPaintingGenre(it.value);
                  }}
                >
                  <Text>{it.label}</Text>
                </View>
              ))}
              <View
                className={`chip ${!paintingGenre ? 'chip-active' : ''}`}
                onClick={() => {
                  if (!canEdit) return;
                  setPaintingGenre('');
                }}
              >
                <Text>不填</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">创作者*</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={creatorName} onChange={setCreatorName} placeholder="例：张三" maxLength={200} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">创作日期（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={creationDate} onChange={setCreationDate} placeholder="YYYY-MM-DD" maxLength={20} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">创作年份（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={creationYear} onChange={setCreationYear} placeholder="例：2008" type="number" maxLength={4} clearable disabled={!canEdit} />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">价格与交易</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">报价方式*</Text>
        <View style={{ height: '8rpx' }} />
        <View className="chip-row">
          {PRICE_TYPE_OPTIONS.map((it) => (
            <View
              key={it.value}
              className={`chip ${priceType === it.value ? 'chip-active' : ''}`}
              onClick={() => {
                if (!canEdit) return;
                setPriceType(it.value);
                if (it.value === 'NEGOTIABLE') setPriceYuan('');
              }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
          <View
            className={`chip ${!priceType ? 'chip-active' : ''}`}
            onClick={() => {
              if (!canEdit) return;
              setPriceType('');
              setPriceYuan('');
            }}
          >
            <Text>不填</Text>
          </View>
        </View>

        {priceType === 'FIXED' ? (
          <>
            <View style={{ height: '12rpx' }} />
            <Text className="form-label">一口价（元）</Text>
            <View style={{ height: '8rpx' }} />
            <PublishInput value={priceYuan} onChange={setPriceYuan} placeholder="例：288000" type="digit" clearable disabled={!canEdit} />
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">订金（元）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={depositYuan} onChange={setDepositYuan} placeholder="例：2000" type="digit" clearable disabled={!canEdit} />
        <View style={{ height: '6rpx' }} />
        <Text className="text-caption muted">订金与尾款平台托管，权属确认完成后放款。</Text>
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">证书与补充信息</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">著作权登记证书编号（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput
          value={certificateNo}
          onChange={setCertificateNo}
          placeholder="例：国作登字-2023-F-0123456"
          maxLength={100}
          clearable
          disabled={!canEdit}
        />

        <View style={{ height: '12rpx' }} />
        <View className="row-between">
          <Text className="form-label">证书材料（建议上传）</Text>
          <Text className={`tag ${certificateFiles.length ? 'tag-success' : 'tag-warning'}`}>
            {certificateFiles.length ? `${certificateFiles.length} 份` : '未上传'}
          </Text>
        </View>
        <View style={{ height: '8rpx' }} />
        <Button variant="ghost" loading={uploading} disabled={!canEdit || uploading} onClick={() => void uploadCertificate()}>
          {uploading ? '上传中…' : '上传证书材料'}
        </Button>
        {certificateFiles.length ? (
          <>
            <View style={{ height: '12rpx' }} />
            {certificateFiles.map((f, idx) => (
              <View
                key={f.id}
                className="list-item"
                onClick={() => {
                  if (!f.url) return;
                  if (String(f.mimeType || '').startsWith('image/')) {
                    void Taro.previewImage({ urls: [String(f.url)] });
                    return;
                  }
                  void Taro.setClipboardData({ data: String(f.url) });
                  toast('链接已复制', { icon: 'success' });
                }}
              >
                <View className="min-w-0" style={{ flex: 1 }}>
                  <Text className="muted">{`证书材料 ${idx + 1}`}</Text>
                  <View style={{ height: '4rpx' }} />
                  <Text className="text-caption clamp-1">
                    {f.url ? '点击预览/复制链接' : '已上传'} {f.mimeType ? `· ${String(f.mimeType)}` : ''}{' '}
                    {typeof f.sizeBytes === 'number' ? `· ${(f.sizeBytes / 1024).toFixed(0)}KB` : ''}
                  </Text>
                </View>
                <View style={{ width: '168rpx' }}>
                  <Button
                    variant="danger"
                    fill="outline"
                    size="small"
                    disabled={!canEdit}
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeCertificate(f);
                    }}
                  >
                    移除
                  </Button>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">材质（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={material} onChange={setMaterial} placeholder="例：宣纸/绢本" maxLength={200} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">尺寸（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <PublishInput value={size} onChange={setSize} placeholder="例：138×69 cm" maxLength={100} clearable disabled={!canEdit} />

        <View style={{ height: '12rpx' }} />
        <Text className="form-label">所在地区（可选）</Text>
        <View style={{ height: '8rpx' }} />
        <View className="row" style={{ gap: '12rpx', alignItems: 'center' }}>
          <View className="flex-1">
            <PublishInput value={regionCode} onChange={setRegionCode} placeholder="例：110000" clearable disabled={!canEdit} />
          </View>
          <View style={{ width: '180rpx' }}>
            <Button variant="ghost" size="small" disabled={!canEdit} onClick={() => openRegionPicker()}>
              选择
            </Button>
          </View>
        </View>
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">作品介绍</Text>
        <View style={{ height: '12rpx' }} />
        <PublishTextArea
          value={description}
          onChange={setDescription}
          placeholder="作品风格、题材、创作背景等（5000字以内）"
          maxLength={5000}
          disabled={!canEdit}
        />
      </Surface>

      <View style={{ height: '16rpx' }} />

      <Surface>
        <Text className="text-card-title">封面与作品图片</Text>
        <View style={{ height: '12rpx' }} />

        <Text className="form-label">封面图（可选，推荐）</Text>
        <View style={{ height: '10rpx' }} />
        {coverUrl ? (
          <Image src={coverUrl} mode="aspectFill" style={{ width: '100%', height: '320rpx', borderRadius: '20rpx' }} />
        ) : null}
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
        <Text className="form-label">作品图片/视频/文件（建议至少上传 1 张作品图片）</Text>
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
                    <Image
                      src={(m as any).url as string}
                      mode="aspectFill"
                      style={{ width: '100%', height: '320rpx', borderRadius: '20rpx' }}
                    />
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
          <Text className="muted">尚未上传作品图片/附件。</Text>
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
          <Button
            variant="primary"
            disabled={saving || submitting || uploading || !canEdit}
            loading={submitting}
            onClick={() => void submitForAudit()}
          >
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

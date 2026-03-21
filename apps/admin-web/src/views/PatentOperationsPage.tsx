import { Button, Card, Drawer, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { formatTimeSmart, yuanToFen } from '../lib/format';
import { RequestErrorAlert } from '../ui/RequestState';

type ConsultationRouting = 'PLATFORM' | 'OWNER';
type ListingTradeMode = 'ASSIGNMENT' | 'LICENSE';
type LicenseMode = 'EXCLUSIVE' | 'SOLE' | 'NON_EXCLUSIVE';
type PriceType = 'FIXED' | 'NEGOTIABLE';
type ListingTopic = 'HIGH_TECH_RETIRED' | 'SLEEPING' | 'AWARD_WINNING' | 'OPEN_LICENSE' | 'FIVE_STAR';
type DuplicatePolicy = 'SKIP' | 'OVERWRITE';
type JobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'FAILED';
type ImportRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type Paged<T> = { items: T[]; page: { page: number; pageSize: number; total: number } };

type PatentImportJob = {
  id: string;
  status: JobStatus;
  duplicatePolicy: DuplicatePolicy;
  totalCount: number;
  validCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  failRate: number;
  createdAt: string;
};

type PatentImportJobRow = {
  id: string;
  rowNo: number;
  status: ImportRowStatus;
  normalized?: Record<string, any> | null;
  patentId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type PatentListingGenerateResult = {
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
};

type DefaultsFormValues = {
  duplicatePolicy: DuplicatePolicy;
  consultationRouting: ConsultationRouting;
  sellerUserId?: string;
  tradeMode: ListingTradeMode;
  licenseMode?: LicenseMode;
  priceType: PriceType;
  priceAmountYuan?: number | null;
  depositAmountYuan?: number | null;
  regionCode?: string;
  listingTopics?: ListingTopic[];
  industryTagsText?: string;
};

const duplicatePolicyOptions = [
  { value: 'SKIP', label: '跳过重复' },
  { value: 'OVERWRITE', label: '覆盖重复' },
];

const consultationRoutingOptions = [
  { value: 'PLATFORM', label: '平台客服' },
  { value: 'OWNER', label: '权利人咨询' },
];

const tradeModeOptions = [
  { value: 'ASSIGNMENT', label: '转让' },
  { value: 'LICENSE', label: '许可' },
];

const licenseModeOptions = [
  { value: 'EXCLUSIVE', label: '独占许可' },
  { value: 'SOLE', label: '排他许可' },
  { value: 'NON_EXCLUSIVE', label: '普通许可' },
];

const priceTypeOptions = [
  { value: 'NEGOTIABLE', label: '面议' },
  { value: 'FIXED', label: '一口价' },
];

const listingTopicOptions = [
  { value: 'HIGH_TECH_RETIRED', label: '退役专利' },
  { value: 'SLEEPING', label: '沉睡专利' },
  { value: 'AWARD_WINNING', label: '获奖专利' },
  { value: 'OPEN_LICENSE', label: '开放许可' },
  { value: 'FIVE_STAR', label: '五星专利' },
];

function parseTextList(text?: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .split(/[\n,，;；、]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function buildListingDefaults(values: DefaultsFormValues): { payload?: Record<string, unknown>; error?: string } {
  const listingDefaults: Record<string, unknown> = {
    consultationRouting: values.consultationRouting,
    tradeMode: values.tradeMode,
    priceType: values.priceType,
    depositAmountFen: yuanToFen(values.depositAmountYuan ?? 0),
    listingTopics: values.listingTopics || [],
    auditStatus: 'APPROVED',
    status: 'ACTIVE',
  };
  if (values.consultationRouting === 'PLATFORM') {
    const sellerUserId = String(values.sellerUserId || '').trim();
    if (sellerUserId) listingDefaults.sellerUserId = sellerUserId;
  }
  if (values.tradeMode === 'LICENSE') {
    if (!values.licenseMode) return { error: '许可模式不能为空' };
    listingDefaults.licenseMode = values.licenseMode;
  }
  if (values.priceType === 'FIXED') {
    if (!values.priceAmountYuan || Number(values.priceAmountYuan) <= 0) {
      return { error: '一口价模式必须填写挂牌价格（元）' };
    }
    listingDefaults.priceAmountFen = yuanToFen(values.priceAmountYuan);
  }
  const regionCode = String(values.regionCode || '').trim();
  if (regionCode) listingDefaults.regionCode = regionCode;
  const industryTags = parseTextList(values.industryTagsText);
  if (industryTags.length) listingDefaults.industryTags = industryTags;
  return { payload: listingDefaults };
}

export function PatentOperationsPage() {
  const [error, setError] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Paged<PatentImportJob> | null>(null);
  const [file, setFile] = useState<FileObject | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rowsOpen, setRowsOpen] = useState(false);
  const [rows, setRows] = useState<Paged<PatentImportJobRow> | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [patentIdsText, setPatentIdsText] = useState('');
  const [generateResult, setGenerateResult] = useState<PatentListingGenerateResult | null>(null);
  const [form] = Form.useForm<DefaultsFormValues>();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Paged<PatentImportJob>>('/admin/patents/jobs/import', { page: 1, pageSize: 20 });
      setJobs(res);
    } catch (e: any) {
      setError(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      duplicatePolicy: 'SKIP',
      consultationRouting: 'PLATFORM',
      tradeMode: 'ASSIGNMENT',
      priceType: 'NEGOTIABLE',
      depositAmountYuan: 0,
      listingTopics: [],
    });
    void loadJobs();
  }, [form, loadJobs]);

  const uploadExcel = useCallback(async (options: any) => {
    try {
      setUploading(true);
      const uploaded = await apiUploadFile(options.file as File, 'PATENT_IMPORT');
      setFile(uploaded);
      message.success('Excel 上传成功');
      options.onSuccess?.(uploaded);
    } catch (e: any) {
      message.error(e?.message || '上传失败');
      options.onError?.(e);
    } finally {
      setUploading(false);
    }
  }, []);

  const createImportJob = useCallback(
    async (autoExecute: boolean) => {
      if (!file?.id) return message.warning('请先上传 Excel 文件');
      const values = await form.validateFields();
      const built = buildListingDefaults(values);
      if (!built.payload) return message.error(built.error || '默认上架参数不合法');
      try {
        setSubmitting(true);
        const created = await apiPost<{ id: string }>(
          '/admin/patents/jobs/import',
          { fileId: file.id, duplicatePolicy: values.duplicatePolicy, defaults: { listing: { enabled: true, ...built.payload } } },
          { idempotencyKey: `admin-patent-import-create-${Date.now()}` },
        );
        if (autoExecute) {
          await apiPost(`/admin/patents/jobs/import/${created.id}/validate`, {}, { idempotencyKey: `validate-${Date.now()}` });
          await apiPost(`/admin/patents/jobs/import/${created.id}/execute`, {}, { idempotencyKey: `execute-${Date.now()}` });
        }
        message.success(autoExecute ? '任务已创建并执行' : '任务已创建');
        void loadJobs();
      } catch (e: any) {
        message.error(e?.message || '创建任务失败');
      } finally {
        setSubmitting(false);
      }
    },
    [file?.id, form, loadJobs],
  );

  const runBatchGenerate = useCallback(async () => {
    const patentIds = parseTextList(patentIdsText);
    if (!patentIds.length) return message.warning('请先输入专利ID列表');
    const values = await form.validateFields();
    const built = buildListingDefaults(values);
    if (!built.payload) return message.error(built.error || '默认上架参数不合法');
    try {
      setSubmitting(true);
      const result = await apiPost<PatentListingGenerateResult>(
        '/admin/patents/jobs/listings',
        { patentIds, duplicatePolicy: values.duplicatePolicy, listingDefaults: built.payload },
        { idempotencyKey: `admin-patent-listings-${Date.now()}` },
      );
      setGenerateResult(result);
      message.success(`批量上架执行完成：成功 ${result.successCount}，失败 ${result.failedCount}，跳过 ${result.skippedCount}`);
    } catch (e: any) {
      message.error(e?.message || '批量上架失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, patentIdsText]);

  const openRows = useCallback(async (jobId: string) => {
    setActiveJobId(jobId);
    setRowsOpen(true);
    try {
      const res = await apiGet<Paged<PatentImportJobRow>>(`/admin/patents/jobs/import/${jobId}/rows`, { page: 1, pageSize: 50 });
      setRows(res);
    } catch (e: any) {
      message.error(e?.message || '加载任务明细失败');
    }
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>专利批量运营</Typography.Title>
        <Typography.Paragraph type="secondary">统一执行 Excel 导入、批量上架和任务追踪。</Typography.Paragraph>
        {error ? <RequestErrorAlert error={error} onRetry={loadJobs} /> : null}
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Upload accept=".xlsx,.xls" showUploadList={false} customRequest={uploadExcel} disabled={uploading || submitting}>
            <Button loading={uploading}>上传 Excel 文件</Button>
          </Upload>
          <Typography.Text type="secondary">{file?.id ? `文件ID：${file.id}` : '未上传文件'}</Typography.Text>
          <Form form={form} layout="vertical">
            <Space wrap>
              <Form.Item label="重复策略" name="duplicatePolicy" rules={[{ required: true }]}><Select style={{ width: 160 }} options={duplicatePolicyOptions} /></Form.Item>
              <Form.Item label="咨询路由" name="consultationRouting" rules={[{ required: true }]}><Select style={{ width: 160 }} options={consultationRoutingOptions} /></Form.Item>
              <Form.Item label="交易模式" name="tradeMode" rules={[{ required: true }]}><Select style={{ width: 160 }} options={tradeModeOptions} /></Form.Item>
              <Form.Item label="许可模式" name="licenseMode"><Select style={{ width: 160 }} allowClear options={licenseModeOptions} /></Form.Item>
              <Form.Item label="价格模式" name="priceType" rules={[{ required: true }]}><Select style={{ width: 140 }} options={priceTypeOptions} /></Form.Item>
              <Form.Item label="挂牌价格(元)" name="priceAmountYuan"><InputNumber min={0.01} precision={2} /></Form.Item>
              <Form.Item label="保证金(元)" name="depositAmountYuan"><InputNumber min={0} precision={2} /></Form.Item>
              <Form.Item label="平台卖家用户ID" name="sellerUserId"><Input style={{ width: 220 }} /></Form.Item>
            </Space>
            <Form.Item label="特色标签" name="listingTopics"><Select mode="multiple" allowClear options={listingTopicOptions} /></Form.Item>
            <Form.Item label="行业标签（逗号/分号/换行分隔）" name="industryTagsText"><Input.TextArea rows={2} /></Form.Item>
          </Form>
          <Space>
            <Button type="primary" loading={submitting} onClick={() => void createImportJob(false)}>创建导入任务</Button>
            <Button loading={submitting} onClick={() => void createImportJob(true)}>创建并执行导入</Button>
            <Button onClick={() => void loadJobs()}>刷新任务</Button>
          </Space>
        </Space>
      </Card>

      <Card title="按专利ID批量上架">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea rows={4} value={patentIdsText} onChange={(e) => setPatentIdsText(e.target.value)} placeholder="每行一个专利ID，或逗号分隔" />
          <Button type="primary" loading={submitting} onClick={() => void runBatchGenerate()}>执行批量上架</Button>
          {generateResult ? <Typography.Text type="secondary">总 {generateResult.totalCount}，成功 {generateResult.successCount}，失败 {generateResult.failedCount}，跳过 {generateResult.skippedCount}</Typography.Text> : null}
        </Space>
      </Card>

      <Card title="导入任务列表">
        <Table<PatentImportJob>
          rowKey="id"
          loading={loading}
          dataSource={jobs?.items || []}
          pagination={false}
          columns={[
            { title: '任务ID', dataIndex: 'id', width: 260 },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: JobStatus) => <Tag>{v}</Tag> },
            { title: '策略', dataIndex: 'duplicatePolicy', width: 90 },
            { title: '统计', render: (_, r) => `总 ${r.totalCount}/有效 ${r.validCount}/成功 ${r.successCount}/失败 ${r.failedCount}/跳过 ${r.skippedCount}` },
            { title: '失败率', dataIndex: 'failRate', width: 100, render: (v: number) => `${Math.round((Number(v) || 0) * 100)}%` },
            { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v: string) => formatTimeSmart(v) },
            { title: '操作', width: 180, render: (_, r) => <Button size="small" onClick={() => void openRows(r.id)}>查看明细</Button> },
          ]}
        />
      </Card>

      <Drawer open={rowsOpen} width={980} title={activeJobId ? `任务明细 ${activeJobId}` : '任务明细'} onClose={() => setRowsOpen(false)}>
        <Table<PatentImportJobRow>
          rowKey="id"
          dataSource={rows?.items || []}
          pagination={false}
          columns={[
            { title: '行号', dataIndex: 'rowNo', width: 80 },
            { title: '状态', dataIndex: 'status', width: 110, render: (v: ImportRowStatus) => <Tag>{v}</Tag> },
            { title: '申请号', render: (_, r) => String(r.normalized?.applicationNoNorm || '-') },
            { title: '标题', render: (_, r) => String(r.normalized?.title || '-') },
            { title: '专利ID', dataIndex: 'patentId', render: (v: string | null | undefined) => v || '-' },
            { title: '错误', render: (_, r) => [r.errorCode, r.errorMessage].filter(Boolean).join(': ') || '-' },
          ]}
        />
      </Drawer>
    </Space>
  );
}

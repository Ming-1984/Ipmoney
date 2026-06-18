import { Alert, Button, Card, Input, InputNumber, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { displayAdminInfo } from '../lib/userFacingText';

type RatingPolicy = 'KEEP_EXISTING' | 'FILL_MISSING' | 'FORCE_SET';

type PreviewRowError = { rowNo: number; reason: string };
type PreviewSection = { totalRows: number; validRows: number; invalidRows: number; sampleErrors: PreviewRowError[] };
type ExecuteSection = PreviewSection & { created: number; updated: number; skipped: number; failed: number };

type ImportPreviewResult = {
  scope: 'PEOPLE_ACHIEVEMENTS';
  input: {
    peopleFileId: string | null;
    achievementsFileId: string | null;
    sourceBatch: string;
    defaultRegionCode: string;
    ratingPolicy: RatingPolicy;
    defaultRatingScore: number;
    defaultRatingCount: number;
  };
  people: PreviewSection;
  achievements: PreviewSection;
};

type ImportExecuteResult = Omit<ImportPreviewResult, 'people' | 'achievements'> & {
  people: ExecuteSection;
  achievements: ExecuteSection;
};

type ImportHistoryAction = 'ALL' | 'PREVIEW' | 'EXECUTE';
type ImportHistoryItem = {
  id: string;
  action: string;
  actorUserId: string;
  actorName?: string;
  actorPhone?: string;
  createdAt: string;
  input: {
    peopleFileId: string | null;
    achievementsFileId: string | null;
    sourceBatch: string | null;
    defaultRegionCode: string | null;
    ratingPolicy: RatingPolicy | null;
    defaultRatingScore: number | null;
    defaultRatingCount: number | null;
  };
  people: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  achievements: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
};
type ImportHistoryResult = {
  items: ImportHistoryItem[];
  page: { page: number; pageSize: number; total: number };
};

const ratingPolicyOptions: Array<{ value: RatingPolicy; label: string }> = [
  { value: 'FILL_MISSING', label: '仅补齐无评分' },
  { value: 'KEEP_EXISTING', label: '保留现有评分' },
  { value: 'FORCE_SET', label: '全量覆盖评分' },
];

function importHistoryActionLabel(value: string): string {
  return value.includes('EXECUTE') ? '执行导入' : '预检';
}

function SectionStatCard(props: { title: string; section: PreviewSection | ExecuteSection }) {
  const { title, section } = props;
  const extra = section as ExecuteSection;
  const hasExecute = typeof extra.created === 'number';

  return (
    <Card size="small" title={title}>
      <Space wrap size={12}>
        <Tag color="blue">总行: {section.totalRows}</Tag>
        <Tag color="green">有效: {section.validRows}</Tag>
        <Tag color={section.invalidRows > 0 ? 'orange' : 'default'}>无效: {section.invalidRows}</Tag>
        {hasExecute ? <Tag color="cyan">新增: {extra.created}</Tag> : null}
        {hasExecute ? <Tag color="purple">更新: {extra.updated}</Tag> : null}
        {hasExecute ? <Tag color="default">跳过: {extra.skipped}</Tag> : null}
        {hasExecute ? <Tag color={extra.failed > 0 ? 'red' : 'default'}>失败: {extra.failed}</Tag> : null}
      </Space>
    </Card>
  );
}

export function BulkImportPage() {
  const [peopleFile, setPeopleFile] = useState<FileObject | null>(null);
  const [achievementsFile, setAchievementsFile] = useState<FileObject | null>(null);

  const [sourceBatch, setSourceBatch] = useState('people-achievements-manual');
  const [defaultRegionCode, setDefaultRegionCode] = useState('440000');
  const [ratingPolicy, setRatingPolicy] = useState<RatingPolicy>('FILL_MISSING');
  const [defaultRatingScore, setDefaultRatingScore] = useState<number>(4.8);
  const [defaultRatingCount, setDefaultRatingCount] = useState<number>(16);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ImportExecuteResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAction, setHistoryAction] = useState<ImportHistoryAction>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyData, setHistoryData] = useState<ImportHistoryResult | null>(null);

  const previewErrors = useMemo(() => {
    const rows: Array<{ key: string; group: string; rowNo: number; reason: string }> = [];
    if (previewResult) {
      previewResult.people.sampleErrors.forEach((err, idx) => {
        rows.push({ key: `p-${idx}-${err.rowNo}`, group: '技术经理人', rowNo: err.rowNo, reason: err.reason });
      });
      previewResult.achievements.sampleErrors.forEach((err, idx) => {
        rows.push({ key: `a-${idx}-${err.rowNo}`, group: '成果', rowNo: err.rowNo, reason: err.reason });
      });
    }
    if (executeResult) {
      executeResult.people.sampleErrors.forEach((err, idx) => {
        rows.push({ key: `ep-${idx}-${err.rowNo}`, group: '执行/技术经理人', rowNo: err.rowNo, reason: err.reason });
      });
      executeResult.achievements.sampleErrors.forEach((err, idx) => {
        rows.push({ key: `ea-${idx}-${err.rowNo}`, group: '执行/成果', rowNo: err.rowNo, reason: err.reason });
      });
    }
    return rows;
  }, [executeResult, previewResult]);

  const buildPayload = () => ({
    peopleFileId: peopleFile?.id || undefined,
    achievementsFileId: achievementsFile?.id || undefined,
    sourceBatch: sourceBatch.trim() || undefined,
    defaultRegionCode: defaultRegionCode.trim() || undefined,
    ratingPolicy,
    defaultRatingScore,
    defaultRatingCount,
  });

  const loadHistory = useCallback(
    async (opts?: { page?: number; action?: ImportHistoryAction }) => {
      const page = opts?.page ?? historyPage;
      const action = opts?.action ?? historyAction;
      setHistoryLoading(true);
      try {
        const result = await apiGet<ImportHistoryResult>('/admin/imports/people-achievements/history', {
          page,
          pageSize: 10,
          action: action === 'ALL' ? undefined : action,
        });
        setHistoryData(result);
      } catch (e: any) {
        message.error(e?.message || '导入历史加载失败');
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyAction, historyPage],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleUpload = async (file: File, setter: (f: FileObject) => void) => {
    try {
      const uploaded = await apiUploadFile(file, 'ADMIN_IMPORT');
      setter(uploaded);
      message.success(`文件上传成功: ${file.name}`);
    } catch (e: any) {
      message.error(e?.message || `上传失败: ${file.name}`);
    }
    return false;
  };

  const runPreview = async () => {
    if (!peopleFile?.id && !achievementsFile?.id) {
      message.warning('请至少上传一个导入文件（技术经理人或成果）');
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await apiPost<ImportPreviewResult>('/admin/imports/people-achievements/preview', buildPayload(), {
        idempotencyKey: `bulk-import-preview-${Date.now()}`,
      });
      setPreviewResult(result);
      setExecuteResult(null);
      message.success('预检完成');
    } catch (e: any) {
      message.error(e?.message || '预检失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runExecute = async () => {
    if (!peopleFile?.id && !achievementsFile?.id) {
      message.warning('请至少上传一个导入文件（技术经理人或成果）');
      return;
    }
    setExecuteLoading(true);
    try {
      const result = await apiPost<ImportExecuteResult>('/admin/imports/people-achievements/execute', buildPayload(), {
        idempotencyKey: `bulk-import-execute-${Date.now()}`,
      });
      setExecuteResult(result);
      message.success('导入执行完成');
      void loadHistory({ page: 1 });
    } catch (e: any) {
      message.error(e?.message || '导入执行失败');
    } finally {
      setExecuteLoading(false);
    }
  };

  return (
    <Card className="admin-bulk-import-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            统一批量导入
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            统一处理技术经理人与成果导入，支持预检、执行、评分补齐策略与错误明细，避免离线脚本造成字段漂移。
          </Typography.Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          message="导入规范"
          description="请上传标准 Excel 文件。技术经理人表头建议：姓名/职位/任职单位/服务方向/工作亮点/照片；成果表头建议：成果编号/成果名称/分类/状态/地区/研究机构/成果描述/图片路径。"
        />

        <Card size="small" title="1. 上传导入文件">
          <Space wrap size={12}>
            <Upload
              beforeUpload={(file) => handleUpload(file as File, (f) => setPeopleFile(f))}
              showUploadList={false}
              accept=".xlsx"
            >
              <Button>上传技术经理人 Excel</Button>
            </Upload>
            <Typography.Text type={peopleFile ? 'success' : 'secondary'}>
              {peopleFile ? '已上传人员文件' : '未上传'}
            </Typography.Text>
          </Space>
          <div style={{ height: 8 }} />
          <Space wrap size={12}>
            <Upload
              beforeUpload={(file) => handleUpload(file as File, (f) => setAchievementsFile(f))}
              showUploadList={false}
              accept=".xlsx"
            >
              <Button>上传成果 Excel</Button>
            </Upload>
            <Typography.Text type={achievementsFile ? 'success' : 'secondary'}>
              {achievementsFile ? '已上传成果文件' : '未上传'}
            </Typography.Text>
          </Space>
        </Card>

        <Card size="small" title="2. 导入参数">
          <Space wrap size={12}>
            <Input
              value={sourceBatch}
              onChange={(e) => setSourceBatch(e.target.value)}
              placeholder="导入批次标识"
              style={{ width: 220 }}
            />
            <Input
              value={defaultRegionCode}
              onChange={(e) => setDefaultRegionCode(e.target.value)}
              placeholder="默认地区名称或代码"
              style={{ width: 180 }}
            />
            <Select<RatingPolicy>
              value={ratingPolicy}
              onChange={(v) => setRatingPolicy(v)}
              options={ratingPolicyOptions}
              style={{ width: 180 }}
            />
            <InputNumber
              value={defaultRatingScore}
              min={0}
              max={5}
              step={0.1}
              precision={1}
              onChange={(v) => setDefaultRatingScore(typeof v === 'number' ? v : 4.8)}
              style={{ width: 140 }}
              placeholder="默认评分"
            />
            <InputNumber
              value={defaultRatingCount}
              min={0}
              precision={0}
              onChange={(v) => setDefaultRatingCount(typeof v === 'number' ? v : 16)}
              style={{ width: 140 }}
              placeholder="默认评分人数"
            />
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            评分策略：保留现有评分 / 仅补齐无评分 / 全量覆盖评分。
          </Typography.Paragraph>
        </Card>

        <Space>
          <Button type="default" loading={previewLoading} onClick={() => void runPreview()}>
            预检
          </Button>
          <Button type="primary" danger loading={executeLoading} onClick={() => void runExecute()}>
            执行导入
          </Button>
        </Space>

        {previewResult ? (
          <Card size="small" title="预检结果">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <SectionStatCard title="技术经理人" section={previewResult.people} />
              <SectionStatCard title="成果" section={previewResult.achievements} />
            </Space>
          </Card>
        ) : null}

        {executeResult ? (
          <Card size="small" title="执行结果">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <SectionStatCard title="技术经理人" section={executeResult.people} />
              <SectionStatCard title="成果" section={executeResult.achievements} />
            </Space>
          </Card>
        ) : null}

        {previewErrors.length ? (
          <Card size="small" title="错误明细（抽样）">
            <Table
              rowKey="key"
              pagination={{ pageSize: 10 }}
              dataSource={previewErrors}
              columns={[
                { title: '分组', dataIndex: 'group', width: 160 },
                { title: '行号', dataIndex: 'rowNo', width: 100 },
                { title: '原因', dataIndex: 'reason' },
              ]}
            />
          </Card>
        ) : null}

        <Card
          size="small"
          title="导入历史"
          extra={
            <Space>
              <Select<ImportHistoryAction>
                value={historyAction}
                onChange={(value) => {
                  setHistoryAction(value);
                  setHistoryPage(1);
                  void loadHistory({ page: 1, action: value });
                }}
                style={{ width: 140 }}
                options={[
                  { value: 'ALL', label: '全部' },
                  { value: 'PREVIEW', label: '仅预检' },
                  { value: 'EXECUTE', label: '仅执行' },
                ]}
              />
              <Button onClick={() => void loadHistory()} loading={historyLoading}>
                刷新
              </Button>
            </Space>
          }
        >
          <Table<ImportHistoryItem>
            rowKey="id"
            loading={historyLoading}
            dataSource={historyData?.items || []}
            pagination={{
              current: historyData?.page.page || historyPage,
              pageSize: historyData?.page.pageSize || 10,
              total: historyData?.page.total || 0,
              onChange: (page) => {
                setHistoryPage(page);
                void loadHistory({ page });
              },
            }}
            columns={[
              {
                title: '时间',
                dataIndex: 'createdAt',
                width: 170,
                render: (v: string) => new Date(v).toLocaleString(),
              },
              {
                title: '类型',
                dataIndex: 'action',
                width: 110,
                render: (v: string) => <Tag color={v.includes('EXECUTE') ? 'blue' : 'default'}>{importHistoryActionLabel(v)}</Tag>,
              },
              {
                title: '操作者',
                dataIndex: 'actorName',
                width: 160,
                render: (_: string, r) => displayAdminInfo(r.actorName || r.actorPhone, '平台成员'),
              },
              {
                title: '批次',
                dataIndex: ['input', 'sourceBatch'],
                width: 180,
                ellipsis: true,
                render: (v: string | null) => displayAdminInfo(v),
              },
              {
                title: '技术经理人',
                key: 'people',
                render: (_: unknown, r) => `总${r.people.totalRows} 有效${r.people.validRows} 新增${r.people.created} 更新${r.people.updated}`,
              },
              {
                title: '成果',
                key: 'achievements',
                render: (_: unknown, r) =>
                  `总${r.achievements.totalRows} 有效${r.achievements.validRows} 新增${r.achievements.created} 更新${r.achievements.updated}`,
              },
            ]}
          />
        </Card>
      </Space>
    </Card>
  );
}

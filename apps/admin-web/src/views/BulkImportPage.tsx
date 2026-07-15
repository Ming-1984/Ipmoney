import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost, apiUploadFile, type FileObject } from '../lib/api';
import { displayAdminInfo } from '../lib/userFacingText';

type BadgeImportMode = 'KEEP_EXISTING' | 'APPEND' | 'REPLACE';

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
    badgeImportMode: BadgeImportMode;
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
    badgeImportMode: BadgeImportMode | null;
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

type ImportTemplateField = {
  header: string;
  required: boolean;
  description: string;
  example: string;
};

const badgeImportModeOptions: Array<{ value: BadgeImportMode; label: string }> = [
  { value: 'KEEP_EXISTING', label: '保留系统已有标签' },
  { value: 'APPEND', label: '在原有基础上追加' },
  { value: 'REPLACE', label: '用本次文件覆盖' },
];

const peopleTemplateFields: ImportTemplateField[] = [
  { header: '姓名', required: true, description: '技术经理人姓名，用于匹配或新建经理人资料', example: '张三' },
  { header: '职位', required: false, description: '经理人当前职位或职务', example: '技术转移总监' },
  { header: '任职单位', required: false, description: '所在机构或公司名称', example: '广东某科技服务有限公司' },
  { header: '服务方向', required: false, description: '多个值可用逗号、顿号或分号分隔', example: '成果转化, 技术交易, 投融资对接' },
  { header: '服务标签', required: false, description: '用于展示经理人擅长领域，多个值可分隔填写', example: '新能源, 高校成果转化' },
  { header: '荣誉标签', required: false, description: '支持：十佳技术经理人、金牌经理人、卓越技术经理人、标杆技术经理人、认证经理人、签约经理人', example: '金牌经理人, 认证经理人' },
  { header: '个人简介', required: true, description: '经理人正式简介，预检时会校验必填', example: '长期服务高校与科研院所，聚焦先进制造成果转化落地。' },
  { header: '工作亮点', required: false, description: '补充代表案例、服务亮点、过往经验', example: '累计服务 100+ 项技术转移项目，熟悉校企合作落地。' },
  { header: '从业信息', required: false, description: '前台展示的经验短句', example: '10年成果转化服务经验' },
  { header: '等级标签', required: false, description: '前台展示的等级短标签', example: '资深顾问' },
  { header: '联系人', required: false, description: '对外展示的联系姓名', example: '李老师' },
  { header: '联系电话', required: false, description: '对外展示的联系电话', example: '13800138000' },
  { header: '照片', required: false, description: '图片 URL 或 `/uploads/...` 路径', example: '/uploads/tech-managers/zhangsan.jpg' },
];

const achievementsTemplateFields: ImportTemplateField[] = [
  { header: '成果编号', required: false, description: '外部成果编号；不填时系统会自动生成', example: 'ACH-2026-001' },
  { header: '成果名称', required: true, description: '成果标题，预检时会校验必填', example: '高导热储能电池热管理模块' },
  { header: '分类', required: false, description: '成果所属方向，可写多个分类词', example: '新能源, 储能, 电池材料' },
  { header: '状态', required: false, description: '成果成熟度或当前阶段，系统会自动映射', example: '已产业化' },
  { header: '地区', required: false, description: '填写地区名称或 6 位地区编码；不填时用下方缺省地区', example: '广东省' },
  { header: '研究机构', required: false, description: '成果所属高校、研究院或企业', example: '华南某大学先进制造研究院' },
  { header: '成果描述', required: true, description: '成果详细介绍，预检时会校验必填', example: '该成果适用于动力电池系统热管理，可显著提升散热效率与系统稳定性。' },
  { header: '图片路径', required: false, description: '图片 URL 或 `/uploads/...` 路径', example: '/uploads/achievements/achievement-demo.png' },
];

const peopleTemplateSample: Record<string, string> = {
  姓名: '张三',
  职位: '技术转移总监',
  任职单位: '广东某科技服务有限公司',
  服务方向: '成果转化, 技术交易, 投融资对接',
  服务标签: '新能源, 高校成果转化',
  荣誉标签: '金牌经理人, 认证经理人',
  个人简介: '长期服务高校与科研院所，聚焦先进制造成果转化落地。',
  工作亮点: '累计服务 100+ 项技术转移项目，熟悉校企合作落地。',
  从业信息: '10年成果转化服务经验',
  等级标签: '资深顾问',
  联系人: '李老师',
  联系电话: '13800138000',
  照片: '/uploads/tech-managers/zhangsan.jpg',
};

const achievementsTemplateSample: Record<string, string> = {
  成果编号: 'ACH-2026-001',
  成果名称: '高导热储能电池热管理模块',
  分类: '新能源, 储能, 电池材料',
  状态: '已产业化',
  地区: '广东省',
  研究机构: '华南某大学先进制造研究院',
  成果描述: '该成果适用于动力电池系统热管理，可显著提升散热效率与系统稳定性。',
  图片路径: '/uploads/achievements/achievement-demo.png',
};

function makeDefaultSourceBatch() {
  return `运营手工导入-${new Date().toISOString().slice(0, 10)}`;
}

function badgeImportModeLabel(value: BadgeImportMode | null | undefined): string {
  if (value === 'APPEND') return '在原有基础上追加';
  if (value === 'REPLACE') return '用本次文件覆盖';
  if (value === 'KEEP_EXISTING') return '保留系统已有标签';
  return '-';
}

function importHistoryActionLabel(value: string): string {
  return value.includes('EXECUTE') ? '正式导入' : '预检';
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildImportTemplateCsv(fields: ImportTemplateField[], sample: Record<string, string>): string {
  const headers = fields.map((item) => item.header);
  const headerLine = headers.map((header) => escapeCsv(header)).join(',');
  const sampleLine = headers.map((header) => escapeCsv(sample[header] || '')).join(',');
  return `\uFEFF${headerLine}\n${sampleLine}\n`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
}

function SectionStatCard(props: { title: string; section: PreviewSection | ExecuteSection }) {
  const { title, section } = props;
  const extra = section as ExecuteSection;
  const hasExecute = typeof extra.created === 'number';

  return (
    <Card size="small" title={title}>
      <Space wrap size={12}>
        <Tag color="blue">总行数：{section.totalRows}</Tag>
        <Tag color="green">可导入：{section.validRows}</Tag>
        <Tag color={section.invalidRows > 0 ? 'orange' : 'default'}>有问题：{section.invalidRows}</Tag>
        {hasExecute ? <Tag color="cyan">新增：{extra.created}</Tag> : null}
        {hasExecute ? <Tag color="purple">更新：{extra.updated}</Tag> : null}
        {hasExecute ? <Tag color="default">跳过：{extra.skipped}</Tag> : null}
        {hasExecute ? <Tag color={extra.failed > 0 ? 'red' : 'default'}>失败：{extra.failed}</Tag> : null}
      </Space>
    </Card>
  );
}

export function BulkImportPage() {
  const [peopleFile, setPeopleFile] = useState<FileObject | null>(null);
  const [achievementsFile, setAchievementsFile] = useState<FileObject | null>(null);

  const [sourceBatch, setSourceBatch] = useState(makeDefaultSourceBatch);
  const [defaultRegionCode, setDefaultRegionCode] = useState('440000');
  const [badgeImportMode, setBadgeImportMode] = useState<BadgeImportMode>('KEEP_EXISTING');

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
        rows.push({ key: `ep-${idx}-${err.rowNo}`, group: '正式导入 / 技术经理人', rowNo: err.rowNo, reason: err.reason });
      });
      executeResult.achievements.sampleErrors.forEach((err, idx) => {
        rows.push({ key: `ea-${idx}-${err.rowNo}`, group: '正式导入 / 成果', rowNo: err.rowNo, reason: err.reason });
      });
    }
    return rows;
  }, [executeResult, previewResult]);

  const buildPayload = () => ({
    peopleFileId: peopleFile?.id || undefined,
    achievementsFileId: achievementsFile?.id || undefined,
    sourceBatch: sourceBatch.trim() || undefined,
    defaultRegionCode: defaultRegionCode.trim() || undefined,
    badgeImportMode,
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
      message.success(`文件上传成功：${file.name}`);
    } catch (e: any) {
      message.error(e?.message || `上传失败：${file.name}`);
    }
    return false;
  };

  const downloadPeopleTemplate = useCallback(() => {
    const content = buildImportTemplateCsv(peopleTemplateFields, peopleTemplateSample);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`tech-manager-import-template-${date}.csv`, content, 'text/csv;charset=utf-8');
    message.success('技术经理人模板已开始下载');
  }, []);

  const downloadAchievementsTemplate = useCallback(() => {
    const content = buildImportTemplateCsv(achievementsTemplateFields, achievementsTemplateSample);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`achievement-import-template-${date}.csv`, content, 'text/csv;charset=utf-8');
    message.success('成果模板已开始下载');
  }, []);

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
      message.success('正式导入完成');
      void loadHistory({ page: 1 });
    } catch (e: any) {
      message.error(e?.message || '正式导入失败');
    } finally {
      setExecuteLoading(false);
    }
  };

  return (
    <Card className="admin-bulk-import-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            成果 / 技术经理人导入
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            统一处理技术经理人和成果的批量导入。建议先下载模板整理数据，再上传文件做预检，确认无误后再正式导入。
          </Typography.Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          message="使用前请先看这 3 点"
          description={
            <Space direction="vertical" size={2}>
              <Typography.Text type="secondary">1. 模板表头尽量不要改名，避免系统识别失败。</Typography.Text>
              <Typography.Text type="secondary">2. 先点“先检查数据”，确认没有明显问题后，再点“开始正式导入”。</Typography.Text>
              <Typography.Text type="secondary">3. “经理人标签处理方式”只影响技术经理人的荣誉标签，不影响成果数据。</Typography.Text>
            </Space>
          }
        />

        <Card size="small" title="1. 先下载模板并整理数据">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Button onClick={downloadPeopleTemplate}>下载技术经理人模板（Excel兼容CSV）</Button>
              <Button onClick={downloadAchievementsTemplate}>下载成果模板（Excel兼容CSV）</Button>
            </Space>

            <Card size="small" title="技术经理人模板字段">
              <Table<ImportTemplateField>
                rowKey="header"
                size="small"
                pagination={{
                  pageSize: 5,
                  showSizeChanger: false,
                  hideOnSinglePage: false,
                }}
                dataSource={peopleTemplateFields}
                columns={[
                  { title: '模板列名', dataIndex: 'header', width: 180 },
                  {
                    title: '必填',
                    dataIndex: 'required',
                    width: 90,
                    render: (value: boolean) => (value ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
                  },
                  { title: '说明', dataIndex: 'description' },
                  { title: '示例', dataIndex: 'example', width: 320, render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
                ]}
              />
            </Card>

            <Card size="small" title="成果模板字段">
              <Table<ImportTemplateField>
                rowKey="header"
                size="small"
                pagination={{
                  pageSize: 5,
                  showSizeChanger: false,
                  hideOnSinglePage: false,
                }}
                dataSource={achievementsTemplateFields}
                columns={[
                  { title: '模板列名', dataIndex: 'header', width: 180 },
                  {
                    title: '必填',
                    dataIndex: 'required',
                    width: 90,
                    render: (value: boolean) => (value ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
                  },
                  { title: '说明', dataIndex: 'description' },
                  { title: '示例', dataIndex: 'example', width: 320, render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
                ]}
              />
            </Card>
          </Space>
        </Card>

        <Card size="small" title="2. 上传导入文件">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap size={12}>
              <Upload beforeUpload={(file) => handleUpload(file as File, (f) => setPeopleFile(f))} showUploadList={false} accept=".xlsx,.xls,.csv">
                <Button>上传技术经理人文件</Button>
              </Upload>
              <Typography.Text type={peopleFile ? 'success' : 'secondary'}>
                {peopleFile ? '已上传技术经理人文件' : '还没上传技术经理人文件'}
              </Typography.Text>
            </Space>

            <Space wrap size={12}>
              <Upload
                beforeUpload={(file) => handleUpload(file as File, (f) => setAchievementsFile(f))}
                showUploadList={false}
                accept=".xlsx,.xls,.csv"
              >
                <Button>上传成果文件</Button>
              </Upload>
              <Typography.Text type={achievementsFile ? 'success' : 'secondary'}>
                {achievementsFile ? '已上传成果文件' : '还没上传成果文件'}
              </Typography.Text>
            </Space>
          </Space>
        </Card>

        <Card size="small" title="3. 本次导入设置">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap size={16} align="start">
              <div style={{ width: 280 }}>
                <Typography.Text strong>导入批次名称</Typography.Text>
                <Input
                  value={sourceBatch}
                  onChange={(e) => setSourceBatch(e.target.value)}
                  placeholder="例如：2026-07-成果经理人首批导入"
                  style={{ marginTop: 8 }}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  仅用于后台追溯这一次导入，建议按“日期 + 内容”命名。
                </Typography.Paragraph>
              </div>

              <div style={{ width: 220 }}>
                <Typography.Text strong>缺省地区编码</Typography.Text>
                <Input
                  value={defaultRegionCode}
                  onChange={(e) => setDefaultRegionCode(e.target.value)}
                  placeholder="例如：440000（广东省）"
                  style={{ marginTop: 8 }}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  只有当 Excel 里没填地区时，系统才会用这个编码兜底。
                </Typography.Paragraph>
              </div>

              <div style={{ width: 260 }}>
                <Typography.Text strong>经理人标签处理方式</Typography.Text>
                <Select<BadgeImportMode>
                  value={badgeImportMode}
                  onChange={(value) => setBadgeImportMode(value)}
                  options={badgeImportModeOptions}
                  style={{ width: '100%', marginTop: 8 }}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  只影响技术经理人的“荣誉标签”字段。建议日常导入默认使用“保留系统已有标签”。
                </Typography.Paragraph>
              </div>
            </Space>

            <Alert
              type={badgeImportMode === 'REPLACE' ? 'warning' : 'info'}
              showIcon
              message={badgeImportMode === 'REPLACE' ? '当前已选择：用本次文件覆盖' : '标签处理方式说明'}
              description={
                badgeImportMode === 'REPLACE' ? (
                  <Typography.Text>
                    如果某位技术经理人在导入文件里填写了荣誉标签，系统会按本次文件内容更新这位经理人的现有标签。请确认本次文件是最终版本再使用。
                  </Typography.Text>
                ) : (
                  <Space direction="vertical" size={2}>
                    <Typography.Text type="secondary">保留系统已有标签：适合大多数日常导入场景。</Typography.Text>
                    <Typography.Text type="secondary">在原有基础上追加：适合给现有经理人补充新的荣誉标签。</Typography.Text>
                    <Typography.Text type="secondary">用本次文件覆盖：适合整批重置经理人标签，需谨慎使用。</Typography.Text>
                  </Space>
                )
              }
            />
          </Space>
        </Card>

        <Space>
          <Button type="default" loading={previewLoading} onClick={() => void runPreview()}>
            先检查数据
          </Button>
          <Button type="primary" loading={executeLoading} onClick={() => void runExecute()}>
            开始正式导入
          </Button>
        </Space>

        {previewResult ? (
          <Card size="small" title="检查结果">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <SectionStatCard title="技术经理人" section={previewResult.people} />
              <SectionStatCard title="成果" section={previewResult.achievements} />
            </Space>
          </Card>
        ) : null}

        {executeResult ? (
          <Card size="small" title="正式导入结果">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <SectionStatCard title="技术经理人" section={executeResult.people} />
              <SectionStatCard title="成果" section={executeResult.achievements} />
            </Space>
          </Card>
        ) : null}

        {previewErrors.length ? (
          <Card size="small" title="问题明细（抽样）">
            <Table
              rowKey="key"
              pagination={{ pageSize: 10 }}
              dataSource={previewErrors}
              columns={[
                { title: '数据分组', dataIndex: 'group', width: 180 },
                { title: 'Excel 行号', dataIndex: 'rowNo', width: 120 },
                { title: '问题原因', dataIndex: 'reason' },
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
                  { value: 'ALL', label: '全部记录' },
                  { value: 'PREVIEW', label: '只看预检' },
                  { value: 'EXECUTE', label: '只看正式导入' },
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
                width: 180,
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: '类型',
                dataIndex: 'action',
                width: 110,
                render: (value: string) => <Tag color={value.includes('EXECUTE') ? 'blue' : 'default'}>{importHistoryActionLabel(value)}</Tag>,
              },
              {
                title: '操作人',
                dataIndex: 'actorName',
                width: 160,
                render: (_: string, row) => displayAdminInfo(row.actorName || row.actorPhone, '平台成员'),
              },
              {
                title: '导入批次名称',
                dataIndex: ['input', 'sourceBatch'],
                width: 200,
                render: (value: string | null) => value || '-',
              },
              {
                title: '标签处理方式',
                dataIndex: ['input', 'badgeImportMode'],
                width: 180,
                render: (value: BadgeImportMode | null) => badgeImportModeLabel(value),
              },
              {
                title: '技术经理人',
                key: 'people',
                render: (_, row) => `可导入 ${row.people.validRows} / 新增 ${row.people.created} / 更新 ${row.people.updated}`,
              },
              {
                title: '成果',
                key: 'achievements',
                render: (_, row) => `可导入 ${row.achievements.validRows} / 新增 ${row.achievements.created} / 更新 ${row.achievements.updated}`,
              },
            ]}
          />
        </Card>
      </Space>
    </Card>
  );
}

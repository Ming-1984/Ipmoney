import { UploadOutlined } from '@ant-design/icons';
import { Button, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useState } from 'react';

import { apiUploadFile, type FileObject } from '../lib/api';
import { ContractPreviewLink } from './ContractPreviewLink';

type ContractFileUploadFieldProps = {
  value?: FileObject | null;
  onChange?: (file: FileObject | null) => void;
  disabled?: boolean;
  savedFileUrl?: string | null;
};

const TEXT = {
  upload: '选择合同 PDF',
  uploaded: '待保存合同文件',
  saved: '已保存合同文件',
  viewSaved: '查看',
  empty: '未选择合同 PDF',
  invalidType: '仅支持上传 PDF 合同',
  invalidSize: '合同文件请控制在 30MB 以内',
  success: '合同文件已上传，请点击保存合同完成绑定',
  failed: '合同文件上传失败',
} as const;

function isPdfFile(file: File) {
  const mimeType = String(file.type || '').toLowerCase();
  const fileName = String(file.name || '').toLowerCase();
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
}

export function ContractFileUploadField(props: ContractFileUploadFieldProps) {
  const { value, onChange, disabled = false, savedFileUrl } = props;
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (options: any) => {
      const file = options?.file as File | undefined;
      if (!file) {
        options?.onError?.(new Error('missing file'));
        return;
      }
      if (!isPdfFile(file)) {
        message.error(TEXT.invalidType);
        options?.onError?.(new Error('invalid file type'));
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        message.error(TEXT.invalidSize);
        options?.onError?.(new Error('invalid file size'));
        return;
      }

      setUploading(true);
      try {
        const uploaded = await apiUploadFile(file, 'CONTRACT_EVIDENCE');
        onChange?.(uploaded);
        message.success(TEXT.success);
        options?.onSuccess?.(uploaded);
      } catch (e: any) {
        message.error(e?.message || TEXT.failed);
        options?.onError?.(e);
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  return (
    <Space wrap>
      <Upload
        accept="application/pdf,.pdf"
        customRequest={handleUpload}
        disabled={disabled || uploading}
        maxCount={1}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled}>
          {TEXT.upload}
        </Button>
      </Upload>
      {value?.id ? (
        <Space size={8}>
          <Typography.Text type="secondary">{`${TEXT.uploaded}：${value.fileName || value.id}`}</Typography.Text>
          <ContractPreviewLink fileUrl={value.url}>{TEXT.viewSaved}</ContractPreviewLink>
        </Space>
      ) : savedFileUrl ? (
        <Space size={8}>
          <Typography.Text type="secondary">{TEXT.saved}</Typography.Text>
          <ContractPreviewLink fileUrl={savedFileUrl}>{TEXT.viewSaved}</ContractPreviewLink>
        </Space>
      ) : (
        <Typography.Text type="secondary">{TEXT.empty}</Typography.Text>
      )}
    </Space>
  );
}

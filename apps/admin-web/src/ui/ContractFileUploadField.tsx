import { UploadOutlined } from '@ant-design/icons';
import { Button, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useState } from 'react';

import { apiUploadFile, type FileObject } from '../lib/api';

type ContractFileUploadFieldProps = {
  value?: FileObject | null;
  onChange?: (file: FileObject | null) => void;
  disabled?: boolean;
};

const TEXT = {
  upload: '上传合同 PDF',
  uploaded: '已上传合同文件',
  empty: '未上传合同 PDF',
  invalidType: '仅支持上传 PDF 合同',
  invalidSize: '合同文件请控制在 30MB 以内',
  success: '合同文件上传成功',
  failed: '合同文件上传失败',
} as const;

function isPdfFile(file: File) {
  const mimeType = String(file.type || '').toLowerCase();
  const fileName = String(file.name || '').toLowerCase();
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
}

export function ContractFileUploadField(props: ContractFileUploadFieldProps) {
  const { value, onChange, disabled = false } = props;
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
      <Typography.Text type="secondary">
        {value?.id ? `${TEXT.uploaded}：${value.fileName || value.id}` : TEXT.empty}
      </Typography.Text>
    </Space>
  );
}

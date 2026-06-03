import { Button, Input, Select, Space, Typography, Upload, message } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';

import { apiUploadFile, type FileObject } from '../lib/api';

type BuiltinImageOption = {
  label: string;
  value: string;
};

type ImageUrlUploadFieldProps = {
  value?: string;
  onChange?: (next: string) => void;
  onUploaded?: (file: FileObject) => void | Promise<void>;
  placeholder?: string;
  uploadPurpose?: string;
  maxSizeMb?: number;
  accept?: string;
  disabled?: boolean;
  builtinOptions?: BuiltinImageOption[];
  uploadButtonText?: string;
  allowUrlInput?: boolean;
  previewObjectFit?: 'cover' | 'contain' | 'fill';
};

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function ImageUrlUploadField(props: ImageUrlUploadFieldProps) {
  const {
    value,
    onChange,
    onUploaded,
    placeholder = '请输入图片 URL',
    uploadPurpose = 'ADMIN_IMAGE',
    maxSizeMb = 10,
    accept = 'image/*',
    disabled = false,
    builtinOptions,
    uploadButtonText = '上传图片',
    allowUrlInput = true,
    previewObjectFit = 'cover',
  } = props;
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<FileObject | null>(null);

  const current = String(value || '').trim();
  const isBuiltin = current.startsWith('builtin://');

  const builtinValue = useMemo(() => {
    if (!isBuiltin) return undefined;
    const options = builtinOptions || [];
    if (!options.find((item) => item.value === current)) return undefined;
    return current;
  }, [builtinOptions, current, isBuiltin]);

  const validateFileSize = useCallback(
    (file: File) => {
      const sizeMb = file.size / 1024 / 1024;
      if (sizeMb > maxSizeMb) {
        message.error(`文件过大，需小于 ${maxSizeMb}MB`);
        return false;
      }
      return true;
    },
    [maxSizeMb],
  );

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap>
        <Upload
          showUploadList={false}
          accept={accept}
          disabled={disabled || uploading}
          customRequest={async (options: any) => {
            const file = options?.file as File | undefined;
            if (!file) {
              options?.onError?.(new Error('missing file'));
              return;
            }
            if (!validateFileSize(file)) {
              options?.onError?.(new Error('invalid file size'));
              return;
            }
            setUploading(true);
            try {
              const uploaded = await apiUploadFile(file, uploadPurpose);
              await onUploaded?.(uploaded);
              setLastUploaded(uploaded);
              onChange?.(uploaded.url);
              message.success('图片已上传并自动填充');
              options?.onSuccess?.(uploaded);
            } catch (e: any) {
              message.error(e?.message || '图片上传失败');
              options?.onError?.(e);
            } finally {
              setUploading(false);
            }
          }}
        >
          <Button loading={uploading} disabled={disabled}>
            {uploadButtonText}
          </Button>
        </Upload>

        {(builtinOptions || []).length ? (
          <Select
            allowClear
            disabled={disabled}
            style={{ width: 220 }}
            placeholder="选择内置图"
            value={builtinValue}
            options={builtinOptions}
            onChange={(next) => onChange?.(String(next || ''))}
          />
        ) : null}
      </Space>

      {allowUrlInput ? (
        <Input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : null}

      {isBuiltin ? (
        <Typography.Text type="secondary">{`当前内置图：${current}`}</Typography.Text>
      ) : isHttpUrl(current) ? (
        <img
          src={current}
          alt=""
          style={{
            width: 220,
            height: 124,
            objectFit: previewObjectFit,
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            background: '#fafafa',
          }}
        />
      ) : null}

      {lastUploaded ? <Typography.Text type="secondary">{`最近上传：${lastUploaded.url}`}</Typography.Text> : null}
    </Space>
  );
}

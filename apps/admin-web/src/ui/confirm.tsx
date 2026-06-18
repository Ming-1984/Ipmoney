import type { ReactNode } from 'react';
import React from 'react';
import { Input, Modal, Typography, message } from 'antd';

import { modalBodyScrollStyle } from './modalStyles';

const TEXT = {
  confirm: '\u786e\u8ba4',
  cancel: '\u53d6\u6d88',
  reasonLabel: '\u539f\u56e0/\u5907\u6ce8',
  reasonPlaceholder: '\u8bf7\u586b\u5199\u539f\u56e0\u6216\u5907\u6ce8\uff0c\u4fbf\u4e8e\u5ba1\u8ba1\u548c\u540e\u7eed\u5bf9\u8d26\u3002',
  reasonRequired: '\u8bf7\u5148\u586b\u5199\u539f\u56e0\u6216\u5907\u6ce8\u540e\u518d\u786e\u8ba4',
} as const;

export function confirmAction(options: {
  title: string;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    Modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText ?? TEXT.confirm,
      cancelText: options.cancelText ?? TEXT.cancel,
      okButtonProps: options.danger ? { danger: true } : undefined,
      bodyStyle: modalBodyScrollStyle,
      onOk: () => done(true),
      onCancel: () => done(false),
    });
  });
}

export function confirmActionWithReason(options: {
  title: string;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  reasonRequired?: boolean;
  reasonHint?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value: { ok: boolean; reason?: string }) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    let reasonValue = options.defaultReason || '';

    Modal.confirm({
      title: options.title,
      content: (
        <div>
          {options.content ? <div style={{ marginBottom: 12 }}>{options.content}</div> : null}
          <Typography.Text strong>{options.reasonLabel ?? TEXT.reasonLabel}</Typography.Text>
          <div style={{ height: 8 }} />
          <Input.TextArea
            defaultValue={reasonValue}
            placeholder={options.reasonPlaceholder ?? TEXT.reasonPlaceholder}
            autoSize={{ minRows: 3, maxRows: 6 }}
            onChange={(e) => {
              reasonValue = e.target.value;
            }}
          />
          {options.reasonHint ? (
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">{options.reasonHint}</Typography.Text>
            </div>
          ) : null}
        </div>
      ),
      okText: options.okText ?? TEXT.confirm,
      cancelText: options.cancelText ?? TEXT.cancel,
      okButtonProps: options.danger ? { danger: true } : undefined,
      bodyStyle: modalBodyScrollStyle,
      onOk: async () => {
        const finalReason = (reasonValue || '').trim();
        if (options.reasonRequired && !finalReason) {
          message.error(TEXT.reasonRequired);
          throw new Error('reason_required');
        }
        done({ ok: true, reason: finalReason || undefined });
      },
      onCancel: () => done({ ok: false }),
    });
  });
}

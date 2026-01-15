import type { ReactNode } from 'react';
import React from 'react';
import { Input, Modal, Typography, message } from 'antd';

import { modalBodyScrollStyle } from './modalStyles';
export function confirmAction(options: {
  title: string;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (v: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(v);
    };

    Modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText ?? '确认',
      cancelText: options.cancelText ?? '取消',
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
    const done = (v: { ok: boolean; reason?: string }) => {
      if (resolved) return;
      resolved = true;
      resolve(v);
    };

    let reasonValue = options.defaultReason || '';

    Modal.confirm({
      title: options.title,
      content: (
        <div>
          {options.content ? <div style={{ marginBottom: 12 }}>{options.content}</div> : null}
          <Typography.Text strong>{options.reasonLabel ?? '原因/备注'}</Typography.Text>
          <div style={{ height: 8 }} />
          <Input.TextArea
            defaultValue={reasonValue}
            placeholder={options.reasonPlaceholder ?? '请填写原因（建议尽量具体，便于审计与对账）'}
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
      okText: options.okText ?? '确认',
      cancelText: options.cancelText ?? '取消',
      okButtonProps: options.danger ? { danger: true } : undefined,
      bodyStyle: modalBodyScrollStyle,
      onOk: async () => {
        const finalReason = (reasonValue || '').trim();
        if (options.reasonRequired && !finalReason) {
          message.error('请填写原因/备注后再确认');
          // Reject keeps the modal open.
          throw new Error('reason_required');
        }
        done({ ok: true, reason: finalReason || undefined });
      },
      onCancel: () => done({ ok: false }),
    });
  });
}

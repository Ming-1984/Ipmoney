import type { ReactNode } from 'react';
import { Modal } from 'antd';

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
      onOk: () => done(true),
      onCancel: () => done(false),
    });
  });
}


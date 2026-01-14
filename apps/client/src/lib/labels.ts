import type { components } from '@ipmoney/api-types';

type OrderStatus = components['schemas']['OrderStatus'];

export function orderStatusLabel(status: OrderStatus): string {
  if (status === 'DEPOSIT_PENDING') return '待付订金';
  if (status === 'DEPOSIT_PAID') return '订金已付';
  if (status === 'WAIT_FINAL_PAYMENT') return '待付尾款';
  if (status === 'FINAL_PAID_ESCROW') return '尾款托管中';
  if (status === 'READY_TO_SETTLE') return '待结算';
  if (status === 'COMPLETED') return '已完成';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'REFUNDING') return '退款中';
  if (status === 'REFUNDED') return '已退款';
  return String(status);
}

export function orderStatusTagClass(status: OrderStatus): string {
  if (status === 'COMPLETED') return 'tag tag-success';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'tag tag-danger';
  if (status === 'REFUNDING' || status === 'DEPOSIT_PENDING' || status === 'WAIT_FINAL_PAYMENT') return 'tag tag-warning';
  return 'tag tag-gold';
}


export type RecoveryStatus = 'pending' | 'scheduled' | 'shipped' | 'in_transit' | 'received' | 'paid';
export type RecoveryMethod = 'pickup' | 'shipping';

export interface RecoveryCartItem {
  id: string;
  productName: string;
  productCategory: string;
  productBrand: string;
  thumbnail?: string;
  estimatedPrice: string;
  resalePrice: string;
  quickSalePrice: string;
  confidence: string;
  reason: string;
  recommendedMethod: RecoveryMethod;
  methodReason: string;
  addedAt: string;
}

export interface RecoveryOrder {
  id: string;
  productName: string;
  productCategory: string;
  productBrand: string;
  thumbnail?: string;
  estimatedPrice: string;
  resalePrice: string;
  quickSalePrice: string;
  confidence: string;
  reason: string;
  method: RecoveryMethod;
  status: RecoveryStatus;
  address?: string;
  scheduledTime?: string;
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<RecoveryStatus, string> = {
  pending: '待处理',
  scheduled: '已预约',
  shipped: '已发货',
  in_transit: '运输中',
  received: '已收货',
  paid: '已结款',
};

export const STATUS_COLORS: Record<RecoveryStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-purple-100 text-purple-700',
  received: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

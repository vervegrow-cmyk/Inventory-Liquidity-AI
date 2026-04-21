// ── User types ─────────────────────────────────────────────────────────────
export type UserRole = 'user' | 'seller' | 'broker' | 'recycler' | 'admin';
export type UserType = 'personal' | 'seller' | 'broker';

// ── Status & condition types ────────────────────────────────────────────────
export type InquiryStatus =
  | 'new'
  | 'quoted'
  | 'pending_recovery'
  | 'accepted'
  | 'rejected'
  | 'processing'
  | 'completed';

export type ProductCondition = 'new' | 'like_new' | 'used' | 'damaged';

export type ShippingMethod = 'pickup' | 'warehouse_shipping' | 'fba_transfer';

// ── Pricing breakdown ───────────────────────────────────────────────────────
export interface PricingBreakdown {
  marketReference: number;
  conditionAdjustment: number;
  bulkDiscount: number;
  final: number;
  note?: string;
}

// ── Product ─────────────────────────────────────────────────────────────────
export type RiskLevel       = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface InquiryProduct {
  id: string;
  inquiryId: string;
  // Primary fields
  title: string;
  images: string[];
  condition: ProductCondition;
  estimatedPrice: number;
  pricingReason?: PricingBreakdown | string;
  quantity: number;
  // Legacy / additional
  name?: string;
  category?: string;
  brand?: string;
  description?: string;
  thumbnail?: string;
  tableData?: Record<string, string>;
  priceMin?: number;
  priceMax?: number;
  confidence?: ConfidenceLevel;
  riskLevel?: RiskLevel;
  riskNote?: string;
  recycleAdvice?: string;
  createdAt?: string;
}

export interface InquiryProductInput {
  title?: string;
  name?: string;
  category?: string;
  brand?: string;
  description?: string;
  thumbnail?: string;
  images?: string[];
  condition?: ProductCondition;
  estimatedPrice?: number | string;
  pricingReason?: PricingBreakdown | string;
  quantity?: number;
  tableData?: Record<string, string>;
}

// ── Inquiry ─────────────────────────────────────────────────────────────────
export interface Inquiry {
  id: string;
  userId?: string;
  customerName: string;
  phone: string;
  userName: string;
  contact: string;
  address?: string;
  city?: string;
  country?: string;
  userType: UserType;
  status: InquiryStatus;
  estimatedTotal: number;
  acceptedShippingMethod?: ShippingMethod;
  note?: string;
  createdAt: string;
  updatedAt?: string;
  products: InquiryProduct[];
}

// ── Decision ─────────────────────────────────────────────────────────────────
export type DecisionAction = 'accept' | 'reject' | 'save' | 'accumulate';

export interface Decision {
  id: string;
  inquiryId: string;
  action: DecisionAction;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Logistics ─────────────────────────────────────────────────────────────────
export type LogisticsType   = 'pickup' | 'shipping' | 'fba';
export type LogisticsStatus = 'pending' | 'scheduled' | 'in_transit' | 'completed';

export interface Logistics {
  id: string;
  inquiryId: string;
  type: LogisticsType;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  timeSlot?: string;
  shippingAddress?: string;
  warehouseCode?: string;
  fbaShipmentId?: string;
  trackingNumber?: string;
  status: LogisticsStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Compound detail ───────────────────────────────────────────────────────────
export interface InquiryDetail {
  inquiry: Inquiry;
  products: InquiryProduct[];
  decision: Decision | null;
  logistics: Logistics | null;
}

// ── Statistics ────────────────────────────────────────────────────────────────
export interface InquiryStatistics {
  total: number;
  new: number;
  quoted: number;
  pending_recovery: number;
  accepted: number;
  rejected: number;
  processing: number;
  completed: number;
  totalValue: number;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new:              '待估价',
  quoted:           '已出价',
  pending_recovery: '待回收',
  accepted:         '已确认',
  rejected:         '已拒绝',
  processing:       '处理中',
  completed:        '已完成',
};

export const INQUIRY_STATUS_COLORS: Record<InquiryStatus, string> = {
  new:              'bg-amber-100 text-amber-700',
  quoted:           'bg-blue-100 text-blue-700',
  pending_recovery: 'bg-purple-100 text-purple-700',
  accepted:         'bg-emerald-100 text-emerald-700',
  rejected:         'bg-red-100 text-red-700',
  processing:       'bg-indigo-100 text-indigo-700',
  completed:        'bg-green-100 text-green-700',
};

export const PRODUCT_CONDITION_LABELS: Record<ProductCondition, string> = {
  new:      '全新',
  like_new: '九成新',
  used:     '二手',
  damaged:  '有损坏',
};

export const PRODUCT_CONDITION_COLORS: Record<ProductCondition, string> = {
  new:      'bg-emerald-100 text-emerald-700',
  like_new: 'bg-sky-100 text-sky-700',
  used:     'bg-amber-100 text-amber-700',
  damaged:  'bg-red-100 text-red-700',
};

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  pickup:             '上门取货',
  warehouse_shipping: '寄回仓库',
  fba_transfer:       'FBA转运',
};

export const SHIPPING_METHOD_ICONS: Record<ShippingMethod, string> = {
  pickup:             '🚗',
  warehouse_shipping: '📦',
  fba_transfer:       '🏭',
};

export const USER_TYPE_LABELS: Record<UserType, string> = {
  personal: '个人',
  seller:   '商家',
  broker:   '中介/服务商',
};

// Legacy compat
export type LogisticsTypeAlias = LogisticsType;
export const LOGISTICS_TYPE_LABELS: Record<LogisticsType, string> = {
  pickup:   '上门自提',
  shipping: '邮寄到仓',
  fba:      'FBA倒仓',
};

export const DECISION_ACTION_LABELS: Record<DecisionAction, string> = {
  accept:     '接受估价',
  reject:     '拒绝估价',
  save:       '暂存',
  accumulate: '累加询价',
};

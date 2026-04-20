export type InquiryStatus = 'new' | 'contacted' | 'dealed';

export interface InquiryProduct {
  name: string;
  category: string;
  brand: string;
  thumbnail?: string;
  estimatedPrice?: string;
}

export interface InquiryPickupInfo {
  address: string;
  contactName?: string;
  contactPhone?: string;
  timeSlot?: string;
  notes?: string;
}

export interface Inquiry {
  id: string;
  products: InquiryProduct[];
  userName: string;
  contact: string;
  method: 'pickup' | 'shipping';
  pickupInfo?: InquiryPickupInfo;
  shippingAddress?: string;
  estimatedTotal: number;
  status: InquiryStatus;
  createdAt: string;
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '新询价',
  contacted: '已联系',
  dealed: '已成交',
};

export const INQUIRY_STATUS_COLORS: Record<InquiryStatus, string> = {
  new: 'bg-amber-100 text-amber-700',
  contacted: 'bg-blue-100 text-blue-700',
  dealed: 'bg-emerald-100 text-emerald-700',
};

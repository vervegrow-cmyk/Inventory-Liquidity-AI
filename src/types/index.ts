// ── Domain: Notes ──────────────────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  contentText: string;
  folderId: string | null;
  tags: string[];
  summary: string | null;
  isFavorite: boolean;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Domain: Inventory / Valuation ──────────────────────────────────────────────

export type Phase = 'upload' | 'select' | 'chatting' | 'done';
export type FileType = 'image' | 'video' | 'spreadsheet';

export interface Product {
  name: string;
  category: string;
  brand: string;
}

export interface SpreadsheetProduct {
  name: string;
  category: string;
  brand: string;
  rowText: string;
  details: Record<string, string>;
  thumbnail?: string;
}

export interface UploadedImage {
  base64: string;
  preview: string;
}

export interface ProductGroup {
  indices: number[];
  name: string;
  category: string;
  brand: string;
}

export interface ChatAttachment {
  type: 'image' | 'video' | 'spreadsheet';
  preview: string;
  name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
}

export interface PricingResult {
  estimated_price: string;
  resale_price: string;
  quick_sale_price: string;
  confidence: string;
  reason: string;
}

// ── API Response Envelope ──────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

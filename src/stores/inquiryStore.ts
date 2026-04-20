import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Inquiry, InquiryStatus } from '../types/inquiry';

interface InquiryState {
  inquiries: Inquiry[];
  addInquiry: (inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'status'>) => Inquiry;
  updateStatus: (id: string, status: InquiryStatus) => void;
  removeInquiry: (id: string) => void;
}

export const useInquiryStore = create<InquiryState>()(
  persist(
    (set) => ({
      inquiries: [],

      addInquiry: (data) => {
        const inquiry: Inquiry = {
          ...data,
          id: crypto.randomUUID(),
          status: 'new',
          createdAt: new Date().toISOString(),
        };
        set(s => ({ inquiries: [inquiry, ...s.inquiries] }));
        return inquiry;
      },

      updateStatus: (id, status) => {
        set(s => ({
          inquiries: s.inquiries.map(q => q.id === id ? { ...q, status } : q),
        }));
      },

      removeInquiry: (id) => {
        set(s => ({ inquiries: s.inquiries.filter(q => q.id !== id) }));
      },
    }),
    { name: 'inquiry-store-v1' }
  )
);

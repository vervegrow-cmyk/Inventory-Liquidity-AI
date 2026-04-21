import type { Inquiry } from '../types/inquiry';

const API_URL = '';

export async function getInquiries(status?: string) {
  const response = await fetch(`${API_URL}/api/inquiry/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  return response.json();
}

export async function getInquiry(id: string) {
  const response = await fetch(`${API_URL}/api/inquiry/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });

  return response.json();
}

export async function saveInquiry(data: {
  userName: string;
  contact: string;
  userType?: string;
  note?: string;
  products: Array<{ name: string; category: string; brand: string; thumbnail?: string; estimatedPrice?: string }>;
  estimatedTotal?: number;
}) {
  const response = await fetch(`${API_URL}/api/inquiry/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  return response.json();
}

export async function selectLogistics(data: {
  inquiryId: string;
  type: 'pickup' | 'shipping' | 'fba';
  address?: string;
  contactName?: string;
  contactPhone?: string;
  timeSlot?: string;
  shippingAddress?: string;
  notes?: string;
}) {
  const response = await fetch(`${API_URL}/api/logistics/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  return response.json();
}

export async function updateInquiryStatus(id: string, status: string) {
  const response = await fetch(`${API_URL}/api/inquiry/update-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status })
  });

  return response.json();
}

export async function updateInquiry(id: string, changes: Partial<Inquiry>) {
  const response = await fetch(`${API_URL}/api/inquiry/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...changes })
  });

  return response.json();
}

export async function deleteInquiry(id: string) {
  const response = await fetch(`${API_URL}/api/inquiry/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });

  return response.json();
}

export async function getStatistics() {
  const response = await fetch(`${API_URL}/api/inquiry/statistics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  return response.json();
}

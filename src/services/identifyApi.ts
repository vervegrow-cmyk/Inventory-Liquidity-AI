import type { Product, ApiResponse } from '../types';

export async function callIdentifyApi(params: { image?: string; text?: string }): Promise<Product> {
  const res = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`识别失败 (${res.status})`);
  const json = await res.json() as ApiResponse<Product>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

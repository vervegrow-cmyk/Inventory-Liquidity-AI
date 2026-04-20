import type { ChatMessage, PricingResult, ApiResponse } from '../types';

export type PricingTurnResponse =
  | { reply: string; done: false }
  | (PricingResult & { reply: string; done: true });

export async function callPricingApi(messages: ChatMessage[]): Promise<PricingTurnResponse> {
  const res = await fetch('/api/pricing/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`对话失败 (${res.status})`);
  const json = await res.json() as ApiResponse<PricingTurnResponse>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

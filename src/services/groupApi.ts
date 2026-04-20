import type { Product, ProductGroup } from '../types';

export async function callGroupApi(products: Product[]): Promise<ProductGroup[]> {
  const res = await fetch('/api/identify/group', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? 'Grouping failed');
  return json.data.groups;
}

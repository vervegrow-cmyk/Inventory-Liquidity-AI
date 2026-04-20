import { kimiGroupProducts } from '../skills/kimiGroup.js';

/**
 * Groups an array of identified products into clusters of the same item.
 * Falls back to one-group-per-product if AI grouping fails.
 */
export async function groupProducts(identifiedProducts) {
  if (identifiedProducts.length <= 1) {
    return identifiedProducts.map((p, i) => ({
      indices: [i],
      name: p.name,
      category: p.category,
      brand: p.brand,
    }));
  }

  try {
    return await kimiGroupProducts(identifiedProducts);
  } catch (err) {
    console.warn('[groupAgent] AI grouping failed, falling back to individual groups:', err.message);
    return identifiedProducts.map((p, i) => ({
      indices: [i],
      name: p.name,
      category: p.category,
      brand: p.brand,
    }));
  }
}

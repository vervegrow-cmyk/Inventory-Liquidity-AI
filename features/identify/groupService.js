import { groupProducts } from '../../agents/groupAgent.js';

export async function groupProductsService(products) {
  return groupProducts(products);
}

import { success, fail } from '../../backend/api-core/response.js';
import { ErrorCode } from '../../backend/api-core/errors.js';
import { groupProductsService } from './groupService.js';

export async function groupController(body) {
  const { products } = body ?? {};
  if (!Array.isArray(products) || products.length === 0) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Missing products array');
  }
  try {
    const groups = await groupProductsService(products);
    return success({ groups });
  } catch (err) {
    console.error('[group] error:', err.message);
    return fail(ErrorCode.AI_ERROR, 'AI grouping failed');
  }
}

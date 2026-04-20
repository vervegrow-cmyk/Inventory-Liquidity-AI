import { success, fail } from '../../backend/api-core/response.js';
import { ErrorCode } from '../../backend/api-core/errors.js';
import { createOrder, batchCreateOrders, listOrders, updateStatus } from './service.js';

export async function recoveryCreateController(body) {
  const { item, method, address, scheduledTime } = body ?? {};
  if (!item || !method) return fail(ErrorCode.VALIDATION_ERROR, 'Missing item or method');
  const order = createOrder({ ...item, method, address, scheduledTime });
  return success(order);
}

export async function recoveryBatchCreateController(body) {
  const { items, method, address, scheduledTime } = body ?? {};
  if (!Array.isArray(items) || !items.length || !method) return fail(ErrorCode.VALIDATION_ERROR, 'Missing items or method');
  const orders = batchCreateOrders(items, method, address, scheduledTime);
  return success(orders);
}

export async function recoveryListController(body) {
  const { status } = body ?? {};
  return success(listOrders(status));
}

export async function recoveryStatusController(body) {
  const { id, status, extra } = body ?? {};
  if (!id || !status) return fail(ErrorCode.VALIDATION_ERROR, 'Missing id or status');
  const order = updateStatus(id, status, extra);
  if (!order) return fail(ErrorCode.NOT_FOUND, 'Order not found');
  return success(order);
}

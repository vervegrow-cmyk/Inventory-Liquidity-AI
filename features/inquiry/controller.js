/**
 * Inquiry Controller — validation + routing only, no business logic.
 * Every handler: validate input → call service → return result.
 */

import { success, fail } from '../../backend/api-core/response.js';
import { ErrorCode } from '../../backend/api-core/errors.js';
import * as svc from './service.js';

// ── POST /api/inquiry/create ───────────────────────────────────────────────
export async function inquiryCreateController(body) {
  const { userName, contact, userType, note, products, estimatedTotal, status, address, city, country } = body ?? {};

  if (!userName?.trim())  return fail(ErrorCode.VALIDATION_ERROR, '姓名不能为空');
  if (!contact?.trim())   return fail(ErrorCode.VALIDATION_ERROR, '联系方式不能为空');
  if (userName.length > 100) return fail(ErrorCode.VALIDATION_ERROR, '姓名过长');
  if (contact.length  > 100) return fail(ErrorCode.VALIDATION_ERROR, '联系方式过长');

  try {
    const result = svc.createInquiry({ userName, contact, userType, note, products, estimatedTotal, status, address, city, country });
    return success(result, '询价创建成功');
  } catch (err) {
    return fail(ErrorCode.INTERNAL_ERROR, err.message);
  }
}

// ── POST /api/inquiry/list ────────────────────────────────────────────────
export async function inquiryListController(body) {
  const { status, userType, keyword, page, limit } = body ?? {};
  try {
    const result = svc.listInquiries({ status, userType, keyword, page, limit });
    return success(result);
  } catch (err) {
    return fail(ErrorCode.INTERNAL_ERROR, err.message);
  }
}

// ── POST /api/inquiry/detail ──────────────────────────────────────────────
export async function inquiryDetailController(body) {
  const { id } = body ?? {};
  if (!id) return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');

  const result = svc.getInquiry(id);
  if (!result) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success(result);
}

// ── POST /api/inquiry/update ──────────────────────────────────────────────
export async function inquiryUpdateController(body) {
  const { id, note } = body ?? {};
  if (!id) return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');

  const updated = svc.patchInquiry(id, { note });
  if (!updated) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success({ inquiry: updated });
}

// ── POST /api/inquiry/update-status ──────────────────────────────────────
export async function inquiryUpdateStatusController(body) {
  const { id, status } = body ?? {};
  if (!id)     return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');
  if (!status) return fail(ErrorCode.VALIDATION_ERROR, '缺少 status');

  const result = svc.updateInquiryStatus(id, status);
  if (!result.ok) {
    const code = result.reason === 'NOT_FOUND'
      ? ErrorCode.NOT_FOUND
      : ErrorCode.VALIDATION_ERROR;
    return fail(code, result.reason);
  }

  return success({ inquiry: result.inquiry });
}

// ── POST /api/inquiry/delete ──────────────────────────────────────────────
export async function inquiryDeleteController(body) {
  const { id } = body ?? {};
  if (!id) return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');

  const result = svc.deleteInquiry(id);
  if (!result.ok) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success({ deleted: true });
}

// ── POST /api/inquiry/statistics ─────────────────────────────────────────
export async function inquiryStatisticsController(_body) {
  try {
    const stats = svc.getStatistics();
    return success(stats);
  } catch (err) {
    return fail(ErrorCode.INTERNAL_ERROR, err.message);
  }
}

// ── POST /api/decision/submit ─────────────────────────────────────────────
export async function decisionSubmitController(body) {
  const { inquiryId, action, note } = body ?? {};
  if (!inquiryId) return fail(ErrorCode.VALIDATION_ERROR, '缺少 inquiryId');
  if (!action)    return fail(ErrorCode.VALIDATION_ERROR, '缺少 action');

  const result = svc.submitDecision(inquiryId, { action, note });
  if (!result.ok) {
    const code = result.reason === 'NOT_FOUND'
      ? ErrorCode.NOT_FOUND
      : ErrorCode.VALIDATION_ERROR;
    return fail(code, result.reason);
  }

  return success({ decision: result.decision, inquiry: result.inquiry });
}

// ── POST /api/decision/get ────────────────────────────────────────────────
export async function decisionGetController(body) {
  const { inquiryId } = body ?? {};
  if (!inquiryId) return fail(ErrorCode.VALIDATION_ERROR, '缺少 inquiryId');

  const detail = svc.getInquiry(inquiryId);
  if (!detail) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success({ decision: detail.decision ?? null });
}

// ── POST /api/logistics/select ────────────────────────────────────────────
export async function logisticsSelectController(body) {
  const { inquiryId, type, ...rest } = body ?? {};
  if (!inquiryId) return fail(ErrorCode.VALIDATION_ERROR, '缺少 inquiryId');
  if (!type)      return fail(ErrorCode.VALIDATION_ERROR, '缺少 type');

  if (type === 'pickup' && !rest.address) {
    return fail(ErrorCode.VALIDATION_ERROR, '上门自提需要填写地址');
  }
  if (type === 'fba' && !rest.warehouseCode) {
    return fail(ErrorCode.VALIDATION_ERROR, 'FBA 需要填写仓库代码');
  }

  const result = svc.selectLogistics(inquiryId, { type, ...rest });
  if (!result.ok) {
    const code = result.reason === 'NOT_FOUND'
      ? ErrorCode.NOT_FOUND
      : ErrorCode.VALIDATION_ERROR;
    return fail(code, result.reason);
  }

  return success({ logistics: result.logistics });
}

// ── POST /api/logistics/detail ────────────────────────────────────────────
export async function logisticsDetailController(body) {
  const { inquiryId } = body ?? {};
  if (!inquiryId) return fail(ErrorCode.VALIDATION_ERROR, '缺少 inquiryId');

  const detail = svc.getInquiry(inquiryId);
  if (!detail) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success({ logistics: detail.logistics ?? null });
}

// ── POST /api/admin/inquiry/list ──────────────────────────────────────────
export async function adminInquiryListController(body) {
  const { status, userType, keyword, page, limit } = body ?? {};
  try {
    const result = svc.listInquiries({ status, userType, keyword, page, limit });
    const stats  = svc.getStatistics();
    return success({ ...result, statistics: stats });
  } catch (err) {
    return fail(ErrorCode.INTERNAL_ERROR, err.message);
  }
}

// ── POST /api/admin/inquiry/detail ────────────────────────────────────────
export async function adminInquiryDetailController(body) {
  const { id } = body ?? {};
  if (!id) return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');

  const result = svc.getInquiry(id);
  if (!result) return fail(ErrorCode.NOT_FOUND, '询价不存在');

  return success(result);
}

// ── POST /api/admin/inquiry/update ────────────────────────────────────────
export async function adminInquiryUpdateController(body) {
  const { id, status, note } = body ?? {};
  if (!id) return fail(ErrorCode.VALIDATION_ERROR, '缺少 id');

  let inquiry;

  if (status) {
    const res = svc.updateInquiryStatus(id, status);
    if (!res.ok) {
      const code = res.reason === 'NOT_FOUND'
        ? ErrorCode.NOT_FOUND
        : ErrorCode.VALIDATION_ERROR;
      return fail(code, res.reason);
    }
    inquiry = res.inquiry;
  }

  if (note !== undefined) {
    inquiry = svc.patchInquiry(id, { note }) ?? inquiry;
  }

  return success({ inquiry });
}

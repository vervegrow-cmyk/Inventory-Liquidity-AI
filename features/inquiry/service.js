/**
 * Inquiry Service — business logic only.
 * Reads/writes go through repository; never touches db directly.
 */

import * as repo from './repository.js';

// ── Status machine ────────────────────────────────────────────────────────
// Allowed transitions: from → [allowed next statuses]
const TRANSITIONS = {
  draft:      ['pending'],
  pending:    ['priced', 'draft'],
  priced:     ['accepted', 'rejected', 'saved'],
  saved:      ['accepted', 'rejected', 'pending'],
  accepted:   ['processing'],
  rejected:   [],
  processing: ['completed'],
  completed:  [],
};

const VALID_USER_TYPES  = ['personal', 'seller', 'broker'];
const VALID_STATUSES    = Object.keys(TRANSITIONS);

// ── Create ─────────────────────────────────────────────────────────────────

export function createInquiry({ userName, contact, userType = 'personal', note, products = [] }) {
  const inquiry = repo.createInquiry({
    userName,
    contact,
    userType: VALID_USER_TYPES.includes(userType) ? userType : 'personal',
    status: 'pending',
    estimatedTotal: 0,
    note: note ?? '',
  });

  // Insert each product linked to this inquiry
  const savedProducts = products.map(p =>
    repo.createProduct({
      inquiryId: inquiry.id,
      name:      p.name      ?? '未知商品',
      category:  p.category  ?? '其他',
      brand:     p.brand     ?? '未知品牌',
      description: p.description ?? '',
      thumbnail:   p.thumbnail ?? null,
      tableData:   p.tableData ?? null,
      estimatedPrice: p.estimatedPrice ?? null,
      priceMin:    null,
      priceMax:    null,
      confidence:  null,
      riskLevel:   null,
      riskNote:    null,
      recycleAdvice: null,
    })
  );

  return { inquiry, products: savedProducts };
}

// ── Read ──────────────────────────────────────────────────────────────────

export function getInquiry(id) {
  const inquiry = repo.findInquiryById(id);
  if (!inquiry) return null;

  const products  = repo.findProductsByInquiry(id);
  const decision  = repo.findDecisionByInquiry(id);
  const logistics = repo.findLogisticsByInquiry(id);

  return { inquiry, products, decision, logistics };
}

export function listInquiries({ status, userType, keyword, page = 1, limit = 50 } = {}) {
  let results = repo.findAllInquiries();

  if (status && VALID_STATUSES.includes(status)) {
    results = results.filter(q => q.status === status);
  }
  if (userType && VALID_USER_TYPES.includes(userType)) {
    results = results.filter(q => q.userType === userType);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    results = results.filter(q =>
      q.userName?.toLowerCase().includes(kw) ||
      q.contact?.toLowerCase().includes(kw)
    );
  }

  const total = results.length;
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safePage  = Math.max(1, Number(page) || 1);
  const offset    = (safePage - 1) * safeLimit;
  const items     = results.slice(offset, offset + safeLimit);

  // Embed products into each inquiry for the list view
  const inquiries = items.map(inq => ({
    ...inq,
    products: repo.findProductsByInquiry(inq.id),
  }));

  return { inquiries, total, page: safePage, limit: safeLimit };
}

// ── Update ────────────────────────────────────────────────────────────────

export function updateInquiryStatus(id, newStatus) {
  const inquiry = repo.findInquiryById(id);
  if (!inquiry) return { ok: false, reason: 'NOT_FOUND' };

  const allowed = TRANSITIONS[inquiry.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      reason: `Status transition ${inquiry.status} → ${newStatus} not allowed`,
    };
  }

  const updated = repo.updateInquiry(id, { status: newStatus });
  return { ok: true, inquiry: updated };
}

export function updateInquiryPricing(id, { estimatedTotal, products: productPrices }) {
  // Update top-level total
  const inquiry = repo.updateInquiry(id, { estimatedTotal, status: 'priced' });
  if (!inquiry) return null;

  // Update each product's pricing fields
  if (Array.isArray(productPrices)) {
    productPrices.forEach(({ id: pid, ...patch }) => {
      if (pid) repo.updateProduct(pid, patch);
    });
  }

  return inquiry;
}

export function patchInquiry(id, { note }) {
  return repo.updateInquiry(id, { note });
}

export function deleteInquiry(id) {
  const existed = repo.removeInquiry(id);
  return { ok: existed };
}

// ── Decision ──────────────────────────────────────────────────────────────

const VALID_ACTIONS = ['accept', 'reject', 'save', 'accumulate'];

export function submitDecision(inquiryId, { action, note }) {
  if (!VALID_ACTIONS.includes(action)) {
    return { ok: false, reason: `Invalid action: ${action}` };
  }

  const inquiry = repo.findInquiryById(inquiryId);
  if (!inquiry) return { ok: false, reason: 'NOT_FOUND' };

  // Map action → new inquiry status
  const statusMap = {
    accept:     'accepted',
    reject:     'rejected',
    save:       'saved',
    accumulate: 'saved',   // stays saved, allows more products to be added
  };

  const decision = repo.upsertDecision(inquiryId, { action, note: note ?? '' });
  const updated  = repo.updateInquiry(inquiryId, { status: statusMap[action] });

  return { ok: true, decision, inquiry: updated };
}

// ── Logistics ─────────────────────────────────────────────────────────────

const VALID_LOGISTICS_TYPES = ['pickup', 'shipping', 'fba'];

export function selectLogistics(inquiryId, data) {
  if (!VALID_LOGISTICS_TYPES.includes(data.type)) {
    return { ok: false, reason: `Invalid logistics type: ${data.type}` };
  }

  const inquiry = repo.findInquiryById(inquiryId);
  if (!inquiry) return { ok: false, reason: 'NOT_FOUND' };

  const logistics = repo.upsertLogistics(inquiryId, data);
  return { ok: true, logistics };
}

// ── Statistics ────────────────────────────────────────────────────────────

export function getStatistics() {
  return repo.getStatistics();
}

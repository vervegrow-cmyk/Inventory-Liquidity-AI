/**
 * Inquiry Repository — data access only, no business logic.
 * All DB interactions for inquiries + embedded products go here.
 */

import { getCollection } from '../../backend/db/index.js';

const inquiryCol  = () => getCollection('inquiries');
const productCol  = () => getCollection('products');
const decisionCol = () => getCollection('decisions');
const logisticsCol = () => getCollection('logistics');

// ── Inquiries ──────────────────────────────────────────────────────────────

export function createInquiry(data) {
  return inquiryCol().insert(data);
}

export function findInquiryById(id) {
  return inquiryCol().findById(id);
}

export function findAllInquiries() {
  return inquiryCol()
    .findAll()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findInquiriesWhere(predicate) {
  return inquiryCol()
    .findWhere(predicate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateInquiry(id, patch) {
  return inquiryCol().update(id, patch);
}

export function removeInquiry(id) {
  // cascade: remove linked products, decision, logistics
  productCol().findWhere(p => p.inquiryId === id)
    .forEach(p => productCol().remove(p.id));
  decisionCol().findWhere(d => d.inquiryId === id)
    .forEach(d => decisionCol().remove(d.id));
  logisticsCol().findWhere(l => l.inquiryId === id)
    .forEach(l => logisticsCol().remove(l.id));

  return inquiryCol().remove(id);
}

// ── Products (belong to an inquiry) ───────────────────────────────────────

export function createProduct(data) {
  return productCol().insert(data);
}

export function findProductsByInquiry(inquiryId) {
  return productCol().findWhere(p => p.inquiryId === inquiryId);
}

export function updateProduct(id, patch) {
  return productCol().update(id, patch);
}

// ── Decision ───────────────────────────────────────────────────────────────

export function upsertDecision(inquiryId, data) {
  const existing = decisionCol().findWhere(d => d.inquiryId === inquiryId)[0];
  if (existing) return decisionCol().update(existing.id, data);
  return decisionCol().insert({ ...data, inquiryId });
}

export function findDecisionByInquiry(inquiryId) {
  return decisionCol().findWhere(d => d.inquiryId === inquiryId)[0] ?? null;
}

// ── Logistics ─────────────────────────────────────────────────────────────

export function upsertLogistics(inquiryId, data) {
  const existing = logisticsCol().findWhere(l => l.inquiryId === inquiryId)[0];
  if (existing) return logisticsCol().update(existing.id, data);
  return logisticsCol().insert({ ...data, inquiryId, status: 'pending' });
}

export function findLogisticsByInquiry(inquiryId) {
  return logisticsCol().findWhere(l => l.inquiryId === inquiryId)[0] ?? null;
}

export function updateLogistics(id, patch) {
  return logisticsCol().update(id, patch);
}

// ── Statistics ─────────────────────────────────────────────────────────────

export function getStatistics(predicate) {
  const all = predicate
    ? inquiryCol().findWhere(predicate)
    : inquiryCol().findAll();

  const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  const byStatus = (s) => all.filter(r => r.status === s).length;

  return {
    total:            all.length,
    new:              byStatus('new'),
    quoted:           byStatus('quoted'),
    pending_recovery: byStatus('pending_recovery'),
    accepted:         byStatus('accepted'),
    rejected:         byStatus('rejected'),
    processing:       byStatus('processing'),
    completed:        byStatus('completed'),
    totalValue:       sum(all, 'estimatedTotal'),
  };
}

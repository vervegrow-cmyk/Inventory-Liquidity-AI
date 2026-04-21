import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  Inquiry, InquiryProduct, InquiryStatus, ShippingMethod,
  ProductCondition, PricingBreakdown,
} from '../../types/inquiry';
import { useAdminData } from './AdminLayout';
import {
  INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS,
  PRODUCT_CONDITION_LABELS, PRODUCT_CONDITION_COLORS,
  SHIPPING_METHOD_LABELS, SHIPPING_METHOD_ICONS,
} from '../../types/inquiry';
import { updateInquiryStatus } from '../../services/inquiryApi';

// ── URL-param wrapper (used by router) ────────────────────────────────────────
export function InquiryDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inquiries, loading, handleStatusChange, handleDelete } = useAdminData();

  if (loading) return <div className="text-center py-16 text-slate-400">加载中...</div>;
  const inquiry = inquiries.find(q => q.id === id);
  if (!inquiry) return (
    <div className="text-center py-16">
      <p className="text-lg font-bold text-slate-700">询价不存在</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline">← 返回</button>
    </div>
  );

  return (
    <InquiryDetailPage
      inquiry={inquiry}
      onBack={() => navigate(-1)}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
    />
  );
}

interface Props {
  inquiry: Inquiry;
  onBack: () => void;
  onStatusChange?: (id: string, status: InquiryStatus) => void;
  onDelete?: (id: string) => void;
}

function normalizeProduct(p: InquiryProduct) {
  const title = p.title ?? p.name ?? '未知商品';
  const thumbnail = p.images?.[0] ?? p.thumbnail ?? null;
  const price = typeof p.estimatedPrice === 'number'
    ? p.estimatedPrice
    : parseFloat(String(p.estimatedPrice ?? '0').replace(/[^0-9.]/g, '')) || 0;
  const qty = p.quantity ?? 1;
  const condition: ProductCondition = (p.condition as ProductCondition) ?? 'used';
  return { ...p, title, thumbnail, price, qty, condition };
}

export function InquiryDetailPage({ inquiry, onBack, onStatusChange, onDelete }: Props) {
  const [updating, setUpdating] = useState(false);
  const products = (inquiry.products ?? []).map(normalizeProduct);
  const shippingMethod = inquiry.acceptedShippingMethod as ShippingMethod | undefined;

  const handleStatusUpdate = async (newStatus: InquiryStatus) => {
    setUpdating(true);
    try {
      const res = await updateInquiryStatus(inquiry.id, newStatus);
      if (res.success && onStatusChange) {
        onStatusChange(inquiry.id, newStatus);
      }
    } catch (err) {
      console.error('更新状态失败:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← 返回询价列表
        </button>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${INQUIRY_STATUS_COLORS[inquiry.status]}`}>
          {INQUIRY_STATUS_LABELS[inquiry.status]}
        </span>
      </div>

      {/* Customer info + summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {inquiry.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{inquiry.userName}</p>
              <p className="text-sm text-slate-500">{inquiry.contact}</p>
              {inquiry.address && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <span>📍</span>{inquiry.address}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">总估值</p>
            <p className="text-2xl font-bold text-violet-700">¥{(inquiry.estimatedTotal ?? 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm border-t border-slate-100 pt-4">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">商品数量</p>
            <p className="text-slate-800 font-semibold mt-0.5">{products.length} 件</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">提交时间</p>
            <p className="text-slate-700 mt-0.5">{new Date(inquiry.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">客户类型</p>
            <p className="text-slate-700 mt-0.5">{inquiry.userType ?? '个人'}</p>
          </div>
        </div>
      </div>

      {/* Shipping method (shown when accepted/processing) */}
      {shippingMethod && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">配送方式</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-2xl">{SHIPPING_METHOD_ICONS[shippingMethod]}</span>
            <div>
              <p className="text-xs text-emerald-600 font-semibold uppercase tracking-widest">客户已选</p>
              <p className="text-base font-bold text-emerald-800">{SHIPPING_METHOD_LABELS[shippingMethod]}</p>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">商品明细</p>
          <span className="text-xs text-slate-500">{products.length} 件</span>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">暂无商品信息</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((p, i) => (
              <ProductDetailCard key={p.id ?? i} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {inquiry.note && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">备注</p>
          <p className="text-sm text-slate-700">{inquiry.note}</p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">操作</p>
        <div className="flex flex-wrap gap-2">
          {inquiry.status === 'new' && (
            <button onClick={() => handleStatusUpdate('quoted')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              💡 标记已出价
            </button>
          )}
          {inquiry.status === 'quoted' && (<>
            <button onClick={() => handleStatusUpdate('accepted')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              🤝 客户已接受
            </button>
            <button onClick={() => handleStatusUpdate('rejected')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all disabled:opacity-50">
              ✕ 客户已拒绝
            </button>
          </>)}
          {inquiry.status === 'pending_recovery' && (<>
            <button onClick={() => handleStatusUpdate('accepted')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              ✅ 确认回收
            </button>
            <button onClick={() => handleStatusUpdate('processing')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              🚀 开始处理
            </button>
          </>)}
          {inquiry.status === 'accepted' && (
            <button onClick={() => handleStatusUpdate('processing')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              🚀 开始处理
            </button>
          )}
          {inquiry.status === 'processing' && (
            <button onClick={() => handleStatusUpdate('completed')} disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50">
              ✅ 标记完成
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(inquiry.id)}
              className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all ml-auto"
            >
              删除记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Card ────────────────────────────────────────────────────────

type NP = ReturnType<typeof normalizeProduct>;

function ProductDetailCard({ product }: { product: NP }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { title, thumbnail, price, qty, condition, pricingReason } = product;

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200">
        {thumbnail
          ? <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
        <span className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold py-0.5 ${PRODUCT_CONDITION_COLORS[condition]}`}>
          {PRODUCT_CONDITION_LABELS[condition]}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
        {product.category && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{product.category}{product.brand ? ` · ${product.brand}` : ''}</p>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-slate-500">×{qty}</span>
          <span className={`text-sm font-bold ${price > 0 ? 'text-violet-700' : 'text-slate-400'}`}>
            {price > 0 ? `¥${price.toLocaleString()}` : '待估价'}
          </span>
        </div>

        {pricingReason && (
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
          >
            <svg className={`w-3 h-3 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showBreakdown ? '收起依据' : '估价依据'}
          </button>
        )}
      </div>

      {showBreakdown && pricingReason && (
        <div className="col-span-2 w-full mt-2 pl-19">
          <PricingBreakdownPanel reason={pricingReason as PricingBreakdown | string} />
        </div>
      )}
    </div>
  );
}

function PricingBreakdownPanel({ reason }: { reason: PricingBreakdown | string }) {
  if (typeof reason === 'string') {
    return (
      <div className="mt-1.5 p-2 rounded-lg bg-white border border-slate-200">
        <p className="text-[10px] text-slate-600 leading-relaxed">{reason}</p>
      </div>
    );
  }

  const rows = [
    { label: '市场参考价', value: reason.marketReference, type: 'neutral' },
    { label: '成色调整', value: reason.conditionAdjustment, type: reason.conditionAdjustment < 0 ? 'negative' : 'positive' },
    { label: '批量折扣', value: -Math.abs(reason.bulkDiscount), type: 'negative' },
    { label: 'AI估价', value: reason.final, type: 'highlight' },
  ].filter(r => r.value !== 0 || r.type === 'highlight');

  return (
    <div className="mt-1.5 p-2 rounded-lg bg-white border border-slate-200 space-y-1">
      {rows.map(row => (
        <div key={row.label} className={`flex justify-between text-[10px] ${row.type === 'highlight' ? 'font-bold border-t border-slate-100 pt-1' : ''}`}>
          <span className={row.type === 'highlight' ? 'text-slate-700' : 'text-slate-500'}>{row.label}</span>
          <span className={
            row.type === 'highlight' ? 'text-violet-700' :
            row.type === 'negative' ? 'text-red-600' :
            row.type === 'positive' ? 'text-emerald-600' : 'text-slate-700'
          }>
            {row.value > 0 && row.type !== 'highlight' ? '+' : ''}¥{Math.abs(row.value).toLocaleString()}
          </span>
        </div>
      ))}
      {reason.note && <p className="text-[9px] text-slate-400 italic pt-0.5">{reason.note}</p>}
    </div>
  );
}

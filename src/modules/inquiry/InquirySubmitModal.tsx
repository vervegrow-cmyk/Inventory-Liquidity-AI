import { useState } from 'react';
import type { InquiryProduct } from '../../types/inquiry';
import { saveInquiry, selectLogistics } from '../../services/inquiryApi';

interface Props {
  products: InquiryProduct[];
  estimatedTotal: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export function InquirySubmitModal({ products, estimatedTotal, onClose, onSubmitted }: Props) {
  const [userName, setUserName] = useState('');
  const [contact, setContact] = useState('');
  const [method, setMethod] = useState<'pickup' | 'shipping'>('shipping');
  const [shippingAddress, setShippingAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [pickupTimeSlot, setPickupTimeSlot] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const canSubmit = userName.trim() && contact.trim() && (
    method === 'shipping' || (pickupAddress.trim() && pickupContactPhone.trim())
  );

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Step 1: 创建询价
      const res = await saveInquiry({
        userName: userName.trim(),
        contact: contact.trim(),
        userType: 'personal',
        estimatedTotal,
        products: products.map(p => ({
          title:    p.title ?? p.name ?? '未知商品',
          name:     p.name ?? p.title ?? '未知商品',
          category: p.category ?? '其他',
          brand:    p.brand ?? '未知品牌',
          thumbnail:      p.thumbnail ?? (p.images?.[0] ?? undefined),
          images:         p.images ?? [],
          condition:      p.condition ?? 'used',
          estimatedPrice: p.estimatedPrice ?? 0,
          quantity:       p.quantity ?? 1,
        })),
      });
      if (!res.success) {
        setSubmitError(res.error?.message || '提交失败，请重试');
        return;
      }

      // Step 2: 保存物流方式
      const inquiryId = res.data?.inquiry?.id;
      if (inquiryId) {
        await selectLogistics({
          inquiryId,
          type: method === 'pickup' ? 'pickup' : 'shipping',
          address: method === 'pickup' ? pickupAddress.trim() : undefined,
          contactName: method === 'pickup' ? pickupContactName.trim() || undefined : undefined,
          contactPhone: method === 'pickup' ? pickupContactPhone.trim() || undefined : undefined,
          timeSlot: method === 'pickup' ? pickupTimeSlot || undefined : undefined,
          shippingAddress: method === 'shipping' ? shippingAddress.trim() || undefined : undefined,
          notes: method === 'pickup' ? pickupNotes.trim() || undefined : undefined,
        });
      }

      onSubmitted();
      onClose();
    } catch {
      setSubmitError('网络错误，请检查服务器连接');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0f172a] px-5 py-4 flex items-center justify-between sticky top-0 rounded-t-2xl">
          <div>
            <p className="text-white font-bold text-sm">提交清仓询价</p>
            <p className="text-slate-400 text-xs mt-0.5">{products.length} 件商品 · 总估价 ${estimatedTotal.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product preview */}
          <div className="flex gap-1.5 flex-wrap">
            {products.slice(0, 6).map((p, i) => (
              <div key={i} className="relative">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg border border-slate-200">📦</div>
                )}
                {p.estimatedPrice != null && p.estimatedPrice > 0 && (
                  <span className="absolute -bottom-1 -right-1 text-[9px] bg-violet-600 text-white px-1 py-0.5 rounded-full font-bold leading-none">
                    {typeof p.estimatedPrice === 'number' ? p.estimatedPrice.toLocaleString() : String(p.estimatedPrice).replace('$', '')}
                  </span>
                )}
              </div>
            ))}
            {products.length > 6 && (
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-semibold border border-slate-200">
                +{products.length - 6}
              </div>
            )}
          </div>

          {/* Contact info */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">联系信息</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">姓名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="您的姓名"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">联系方式 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  placeholder="手机号或微信号"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Method */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">回收方式</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'pickup', icon: '🚗', title: '上门自提', desc: '预约时间，我们上门取货' },
                { value: 'shipping', icon: '📦', title: '邮寄回收', desc: '自行寄出，到付或预付' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMethod(opt.value)}
                  className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                    method === opt.value ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xl mb-1">{opt.icon}</div>
                  <p className={`text-xs font-bold ${method === opt.value ? 'text-violet-700' : 'text-slate-700'}`}>{opt.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Shipping address */}
          {method === 'shipping' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">收货地址（可选）</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={e => setShippingAddress(e.target.value)}
                placeholder="填写您的收货地址，稍后可补充"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
            </div>
          )}

          {/* Pickup info */}
          {method === 'pickup' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">上门地址信息</p>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">上门地址 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={e => setPickupAddress(e.target.value)}
                  placeholder="填写详细上门地址"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">联系人</label>
                  <input
                    type="text"
                    value={pickupContactName}
                    onChange={e => setPickupContactName(e.target.value)}
                    placeholder="姓名"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">联系电话 <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={pickupContactPhone}
                    onChange={e => setPickupContactPhone(e.target.value)}
                    placeholder="手机号"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">预约时间</label>
                <input
                  type="datetime-local"
                  value={pickupTimeSlot}
                  onChange={e => setPickupTimeSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">备注（可选）</label>
                <input
                  type="text"
                  value={pickupNotes}
                  onChange={e => setPickupNotes(e.target.value)}
                  placeholder="门牌号、停车说明等"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {submitError && (
            <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              ⚠️ {submitError}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>提交中...</>
            ) : '提交询价'}
          </button>
        </div>
      </div>
    </div>
  );
}

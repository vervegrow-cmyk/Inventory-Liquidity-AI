import { useState } from 'react';
import type { RecoveryMethod, PickupInfo } from '../../types/recovery';
import { useRecoveryStore } from '../../stores/recoveryStore';

interface Props {
  onBack: () => void;
  onOrdersView: () => void;
}

export function RecoveryCartPage({ onBack, onOrdersView }: Props) {
  const { cart, removeFromCart, clearCart, batchCreateOrders } = useRecoveryStore();
  const [batchMethod, setBatchMethod] = useState<RecoveryMethod>('shipping');
  const [batchAddress, setBatchAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [pickupTimeSlot, setPickupTimeSlot] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(cart.map(c => c.id)));
  const [submitted, setSubmitted] = useState(false);

  const pickupValid = batchMethod !== 'pickup' ||
    (pickupAddress.trim() && pickupContactName.trim() && pickupContactPhone.trim() && pickupTimeSlot.trim());

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === cart.length) setSelected(new Set());
    else setSelected(new Set(cart.map(c => c.id)));
  }

  function handleBatchCreate() {
    const items = cart.filter(c => selected.has(c.id));
    if (!items.length || !pickupValid) return;
    let pickupInfo: PickupInfo | undefined;
    if (batchMethod === 'pickup') {
      pickupInfo = {
        address: pickupAddress.trim(),
        contactName: pickupContactName.trim(),
        contactPhone: pickupContactPhone.trim(),
        timeSlot: pickupTimeSlot.trim(),
        notes: pickupNotes.trim() || undefined,
      };
    }
    batchCreateOrders(items, batchMethod, batchAddress || undefined, undefined, pickupInfo);
    setSubmitted(true);
    setTimeout(() => { onOrdersView(); }, 1200);
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
        <p className="text-lg font-bold text-slate-800">订单已创建</p>
        <p className="text-sm text-slate-500 mt-1">正在跳转至订单列表...</p>
      </div>
    );
  }

  if (!cart.length) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">🛒</div>
        <p className="text-lg font-bold text-slate-800">待回收列表为空</p>
        <p className="text-sm text-slate-500 mt-1">同意报价后，将商品加入列表，再批量下单</p>
        <button onClick={onBack} className="mt-6 px-5 py-2.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold">
          ← 返回估价
        </button>
      </div>
    );
  }

  const selectedItems = cart.filter(c => selected.has(c.id));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">待回收列表</h2>
          <p className="text-sm text-slate-500 mt-0.5">{cart.length} 件商品待处理</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">清空列表</button>
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">← 继续估价</button>
        </div>
      </div>

      {/* Select all */}
      <div className="flex items-center gap-2 px-1">
        <input type="checkbox" checked={selected.size === cart.length} onChange={toggleAll} className="w-4 h-4 accent-violet-600" />
        <span className="text-sm text-slate-600">全选 ({selected.size}/{cart.length})</span>
      </div>

      {/* Cart items */}
      <div className="space-y-2">
        {cart.map(item => (
          <div key={item.id} className={`bg-white rounded-2xl border transition-all ${selected.has(item.id) ? 'border-violet-300 shadow-sm' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3 p-4">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggleItem(item.id)}
                className="w-4 h-4 accent-violet-600 mt-1 flex-shrink-0"
              />
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.productName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{item.productName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.productCategory} · {item.productBrand}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">收货价</p>
                    <p className="text-sm font-bold text-violet-700">{item.estimatedPrice}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase">转售价</p>
                    <p className="text-xs font-semibold text-slate-600">{item.resalePrice}</p>
                  </div>
                  <div className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.recommendedMethod === 'pickup' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {item.recommendedMethod === 'pickup' ? '🚗 推荐上门' : '📦 推荐邮寄'}
                  </div>
                </div>
              </div>
              <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none flex-shrink-0">✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Batch create config */}
      {selectedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <p className="text-sm font-bold text-slate-800">批量下单配置 · {selectedItems.length} 件</p>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">统一回收方式</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'pickup', icon: '🚗', label: '上门自提' },
                { value: 'shipping', icon: '📦', label: '邮寄回收' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBatchMethod(opt.value)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    batchMethod === opt.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {batchMethod === 'shipping' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1 block">统一收货地址（可选）</label>
              <input
                type="text"
                value={batchAddress}
                onChange={e => setBatchAddress(e.target.value)}
                placeholder="填写寄货地址，稍后可在订单中修改"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
            </div>
          )}

          {batchMethod === 'pickup' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">上门自提信息</p>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">上门地址 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={e => setPickupAddress(e.target.value)}
                  placeholder="填写详细上门地址（楼栋门牌等）"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">联系人 <span className="text-red-400">*</span></label>
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
                <label className="text-xs text-slate-500 mb-1 block">预约上门时间 <span className="text-red-400">*</span></label>
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
                  placeholder="如：门口停车、电梯位置等"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleBatchCreate}
            disabled={!pickupValid}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            确认创建 {selectedItems.length} 个回收订单
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { PricingResult, Product } from '../../types';
import type { RecoveryMethod, PickupInfo } from '../../types/recovery';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUserInfoStore } from '../../stores/userInfoStore';
import { saveInquiry } from '../../services/inquiryApi';
import { PickupForm } from './PickupForm';

interface Props {
  result: PricingResult;
  product: Product | null;
  thumbnail?: string;
  onClose: () => void;
  onOrderCreated: () => void;
  onAddedToCart: () => void;
}

function parsePrice(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

export function RecoveryMethodModal({ result, product, thumbnail, onClose, onOrderCreated, onAddedToCart }: Props) {
  const recommended = (result.recommended_method ?? 'shipping') as RecoveryMethod;
  const [method, setMethod] = useState<RecoveryMethod>(recommended);
  const [address, setAddress] = useState('');
  const [step, setStep] = useState<'method' | 'pickup-form'>('method');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const { addToCart, createOrder } = useRecoveryStore();
  const userInfo = useUserInfoStore();

  // Local editable copies of user info (pre-filled from store)
  const [userName, setUserName] = useState(userInfo.userName);
  const [contact, setContact] = useState(userInfo.contact);
  const [userAddress, setUserAddress] = useState(userInfo.address);
  const [showInfoEdit, setShowInfoEdit] = useState(!userInfo.hasInfo());

  useEffect(() => {
    if (!userInfo.hasInfo()) setShowInfoEdit(true);
  }, []);

  const cartItem = {
    productName: product?.name ?? '未知商品',
    productCategory: product?.category ?? '',
    productBrand: product?.brand ?? '',
    thumbnail,
    estimatedPrice: result.estimated_price,
    resalePrice: result.resale_price,
    quickSalePrice: result.quick_sale_price,
    confidence: result.confidence,
    reason: result.reason,
    recommendedMethod: recommended,
    methodReason: result.method_reason ?? '',
  };

  function saveUserInfo() {
    if (userName.trim() || contact.trim() || userAddress.trim()) {
      userInfo.setUserInfo({
        userName: userName.trim(),
        contact: contact.trim(),
        address: userAddress.trim(),
      });
    }
  }

  function showSync(msg: string) {
    setSyncMsg(msg);
    setTimeout(() => setSyncMsg(''), 2500);
  }

  async function syncToBackend(status: 'pending_recovery' | 'accepted') {
    saveUserInfo();
    setSyncing(true);
    try {
      await saveInquiry({
        userName: userName.trim() || '匿名用户',
        contact: contact.trim() || '未填写',
        address: userAddress.trim() || undefined,
        userType: 'personal',
        status,
        estimatedTotal: parsePrice(result.estimated_price),
        products: [{
          title: product?.name ?? '未知商品',
          name: product?.name ?? '未知商品',
          category: product?.category ?? '其他',
          brand: product?.brand ?? '未知品牌',
          thumbnail,
          images: thumbnail ? [thumbnail] : [],
          condition: 'used',
          estimatedPrice: parsePrice(result.estimated_price),
          quantity: 1,
        }],
      });
      showSync('✅ 已同步到后台');
    } catch {
      showSync('⚠️ 后台同步失败，本地已保存');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddToCart() {
    await syncToBackend('pending_recovery');
    addToCart(cartItem);
    onAddedToCart();
    onClose();
  }

  async function handleConfirmMethod() {
    if (method === 'pickup') {
      setStep('pickup-form');
    } else {
      await syncToBackend('accepted');
      const item = { ...cartItem, id: crypto.randomUUID(), addedAt: new Date().toISOString() };
      createOrder(item, method, address || undefined);
      onOrderCreated();
      onClose();
    }
  }

  async function handlePickupSubmit(pickupInfo: PickupInfo) {
    await syncToBackend('accepted');
    const item = { ...cartItem, id: crypto.randomUUID(), addedAt: new Date().toISOString() };
    createOrder(item, 'pickup', undefined, undefined, pickupInfo);
    onOrderCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0f172a] px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-lg flex-shrink-0">📦</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{product?.name ?? '未知商品'}</p>
            <p className="text-slate-400 text-xs">
              {step === 'method' ? '同意报价 · 选择回收方式' : '上门自提 · 填写信息'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none flex-shrink-0">✕</button>
        </div>

        {/* Sync feedback */}
        {syncMsg && (
          <div className={`px-5 py-2.5 text-sm font-semibold text-center ${syncMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {syncMsg}
          </div>
        )}

        <div className="p-5 space-y-4">
          {step === 'method' ? (
            <>
              {/* User info section */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setShowInfoEdit(!showInfoEdit)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-sm">👤</span>
                    {userName.trim() || contact.trim() ? (
                      <span className="text-sm text-slate-700 font-medium">
                        {userName.trim() || '—'}
                        {contact.trim() && <span className="text-slate-400 font-normal ml-1.5">{contact.trim()}</span>}
                        {userAddress.trim() && <span className="text-slate-400 font-normal ml-1.5 text-xs">· {userAddress.trim()}</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">填写联系信息（自动保存）</span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${showInfoEdit ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showInfoEdit && (
                  <div className="px-4 py-3 space-y-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1 block">姓名</label>
                        <input
                          type="text"
                          value={userName}
                          onChange={e => setUserName(e.target.value)}
                          onBlur={saveUserInfo}
                          placeholder="您的姓名"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1 block">联系方式</label>
                        <input
                          type="text"
                          value={contact}
                          onChange={e => setContact(e.target.value)}
                          onBlur={saveUserInfo}
                          placeholder="手机号 / 微信"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1 block">地址（可选）</label>
                      <input
                        type="text"
                        value={userAddress}
                        onChange={e => setUserAddress(e.target.value)}
                        onBlur={saveUserInfo}
                        placeholder="省市区 · 详细地址"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Price summary */}
              <div className="bg-violet-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-widest">收货报价</p>
                  <p className="text-xl font-bold text-violet-700 mt-0.5">{result.estimated_price}</p>
                </div>
                <div className="w-px h-8 bg-violet-200" />
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">转售预估</p>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">{result.resale_price}</p>
                </div>
              </div>

              {/* AI recommended method hint */}
              {result.method_reason && (
                <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-200">
                  <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">💡</span>
                  <p className="text-xs text-amber-800 leading-relaxed">{result.method_reason}</p>
                </div>
              )}

              {/* Method selection */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">回收方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'pickup', icon: '🚗', title: '上门自提', desc: '预约时间，我们上门取货' },
                    { value: 'shipping', icon: '📦', title: '邮寄回收', desc: '填写地址，自行寄出商品' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMethod(opt.value)}
                      className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${
                        method === opt.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {recommended === opt.value && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] bg-violet-500 text-white px-1.5 py-0.5 rounded-full font-semibold">推荐</span>
                      )}
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
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1 block">收货地址</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={userAddress || '填写您的收货地址（可选，稍后补充）'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleAddToCart}
                  disabled={syncing}
                  className="py-3 rounded-xl border-2 border-violet-200 bg-violet-50 text-violet-700 text-sm font-semibold hover:bg-violet-100 transition-all disabled:opacity-50"
                >
                  {syncing ? '同步中...' : '+ 加入待回收'}
                </button>
                <button
                  onClick={handleConfirmMethod}
                  disabled={syncing}
                  className="py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md disabled:opacity-50"
                >
                  {syncing ? '同步中...' : method === 'pickup' ? '下一步 →' : '立即创建订单'}
                </button>
              </div>
            </>
          ) : (
            <PickupForm
              onSubmit={handlePickupSubmit}
              onCancel={() => setStep('method')}
              submitLabel="立即创建订单"
            />
          )}
        </div>
      </div>
    </div>
  );
}

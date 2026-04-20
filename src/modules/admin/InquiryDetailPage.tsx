import type { Inquiry } from '../../types/inquiry';
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS } from '../../types/inquiry';
import { useInquiryStore } from '../../stores/inquiryStore';

interface Props {
  inquiry: Inquiry;
  onBack: () => void;
}

export function InquiryDetailPage({ inquiry, onBack }: Props) {
  const { updateStatus, removeInquiry } = useInquiryStore();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
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

      {/* Customer info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">客户信息</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">姓名</p>
            <p className="text-slate-800 font-semibold mt-0.5">{inquiry.userName}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">联系方式</p>
            <p className="text-slate-800 font-semibold mt-0.5">{inquiry.contact}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">回收方式</p>
            <p className="mt-0.5">{inquiry.method === 'pickup' ? '🚗 上门自提' : '📦 邮寄回收'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">提交时间</p>
            <p className="text-slate-700 mt-0.5">{new Date(inquiry.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">总估价</p>
            <p className="text-xl font-bold text-violet-700 mt-0.5">¥{inquiry.estimatedTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Pickup / shipping info */}
      {inquiry.method === 'pickup' && inquiry.pickupInfo && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">上门信息</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">上门地址</p>
              <p className="text-slate-800 mt-0.5">{inquiry.pickupInfo.address}</p>
            </div>
            {inquiry.pickupInfo.contactName && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">联系人</p>
                <p className="text-slate-800 mt-0.5">{inquiry.pickupInfo.contactName}</p>
              </div>
            )}
            {inquiry.pickupInfo.contactPhone && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">联系电话</p>
                <p className="text-slate-800 mt-0.5">{inquiry.pickupInfo.contactPhone}</p>
              </div>
            )}
            {inquiry.pickupInfo.timeSlot && (
              <div className="col-span-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">预约时间</p>
                <p className="text-slate-800 mt-0.5">{new Date(inquiry.pickupInfo.timeSlot).toLocaleString('zh-CN')}</p>
              </div>
            )}
            {inquiry.pickupInfo.notes && (
              <div className="col-span-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">备注</p>
                <p className="text-slate-700 mt-0.5">{inquiry.pickupInfo.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {inquiry.method === 'shipping' && inquiry.shippingAddress && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">收货地址</p>
          <p className="text-sm text-slate-800">{inquiry.shippingAddress}</p>
        </div>
      )}

      {/* Products */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{inquiry.products.length} 件商品</p>
        <div className="space-y-2">
          {inquiry.products.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              {p.thumbnail ? (
                <img src={p.thumbnail} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-200" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.category} · {p.brand}</p>
              </div>
              {p.estimatedPrice && (
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">估价</p>
                  <p className="text-sm font-bold text-violet-700">{p.estimatedPrice}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">操作</p>
        <div className="flex flex-wrap gap-2">
          {inquiry.status === 'new' && (
            <button
              onClick={() => updateStatus(inquiry.id, 'contacted')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm"
            >
              ✓ 标记已联系
            </button>
          )}
          {inquiry.status !== 'dealed' && (
            <button
              onClick={() => updateStatus(inquiry.id, 'dealed')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm"
            >
              🤝 标记成交
            </button>
          )}
          {inquiry.status === 'dealed' && (
            <button
              onClick={() => { removeInquiry(inquiry.id); onBack(); }}
              className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-sm font-semibold transition-all"
            >
              删除记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

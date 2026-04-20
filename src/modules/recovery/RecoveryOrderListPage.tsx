import { useState } from 'react';
import type { RecoveryOrder, RecoveryStatus } from '../../types/recovery';
import { STATUS_LABELS, STATUS_COLORS } from '../../types/recovery';
import { useRecoveryStore } from '../../stores/recoveryStore';

const STATUS_FLOW: RecoveryStatus[] = ['pending', 'scheduled', 'shipped', 'in_transit', 'received', 'paid'];

interface Props {
  onBack: () => void;
}

export function RecoveryOrderListPage({ onBack }: Props) {
  const { orders, updateOrderStatus, removeOrder } = useRecoveryStore();
  const [filterStatus, setFilterStatus] = useState<RecoveryStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<{ id: string; value: string } | null>(null);

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  function nextStatus(current: RecoveryStatus): RecoveryStatus | null {
    const idx = STATUS_FLOW.indexOf(current);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  }

  function handleAdvance(order: RecoveryOrder) {
    const next = nextStatus(order.status);
    if (next) updateOrderStatus(order.id, next);
  }

  function handleSaveTracking(id: string) {
    if (!editingTrack || editingTrack.id !== id) return;
    updateOrderStatus(id, orders.find(o => o.id === id)!.status, { trackingNumber: editingTrack.value });
    setEditingTrack(null);
  }

  if (!orders.length) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">📋</div>
        <p className="text-lg font-bold text-slate-800">暂无回收订单</p>
        <p className="text-sm text-slate-500 mt-1">同意报价并创建订单后，在这里跟踪回收进度</p>
        <button onClick={onBack} className="mt-6 px-5 py-2.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold">
          ← 返回估价
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">回收订单</h2>
          <p className="text-sm text-slate-500 mt-0.5">{orders.length} 个订单</p>
        </div>
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">← 返回估价</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', ...STATUS_FLOW] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterStatus === s
                ? 'bg-[#0f172a] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {s === 'all' ? `全部 (${orders.length})` : `${STATUS_LABELS[s]} (${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {filtered.map(order => {
          const isExpanded = expandedId === order.id;
          const next = nextStatus(order.status);
          return (
            <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Main row */}
              <div className="flex items-start gap-3 p-4">
                {order.thumbnail ? (
                  <img src={order.thumbnail} alt={order.productName} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 text-sm truncate">{order.productName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{order.productCategory} · {order.productBrand}</p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">收货价</p>
                      <p className="text-sm font-bold text-violet-700">{order.estimatedPrice}</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${order.method === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                      {order.method === 'pickup' ? '🚗 上门自提' : '📦 邮寄回收'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="text-slate-400 hover:text-slate-600 text-sm px-1 flex-shrink-0"
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-0.5">
                  {STATUS_FLOW.map((s, i) => {
                    const currentIdx = STATUS_FLOW.indexOf(order.status);
                    const isDone = i <= currentIdx;
                    return (
                      <div key={s} className="flex items-center flex-1">
                        <div className={`h-1.5 flex-1 rounded-full transition-all ${isDone ? 'bg-violet-500' : 'bg-slate-100'}`} />
                        {i < STATUS_FLOW.length - 1 && <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all ${isDone ? 'border-violet-500 bg-violet-500' : 'border-slate-200 bg-white'}`} />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {STATUS_FLOW.map(s => (
                    <span key={s} className={`text-[9px] ${order.status === s ? 'text-violet-600 font-bold' : 'text-slate-300'}`}>
                      {STATUS_LABELS[s]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-widest">创建时间</p>
                      <p className="text-slate-700 mt-0.5">{new Date(order.createdAt).toLocaleString('zh-CN')}</p>
                    </div>
                    {order.scheduledTime && (
                      <div>
                        <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-widest">预约时间</p>
                        <p className="text-slate-700 mt-0.5">{new Date(order.scheduledTime).toLocaleString('zh-CN')}</p>
                      </div>
                    )}
                    {order.address && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-widest">地址</p>
                        <p className="text-slate-700 mt-0.5">{order.address}</p>
                      </div>
                    )}
                  </div>

                  {/* Tracking number */}
                  {order.method === 'shipping' && (
                    <div>
                      <p className="text-slate-400 font-semibold uppercase text-[9px] tracking-widest mb-1">物流单号</p>
                      {editingTrack?.id === order.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingTrack.value}
                            onChange={e => setEditingTrack({ id: order.id, value: e.target.value })}
                            placeholder="输入物流单号"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-violet-400"
                          />
                          <button onClick={() => handleSaveTracking(order.id)} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold">保存</button>
                          <button onClick={() => setEditingTrack(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs">取消</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTrack({ id: order.id, value: order.trackingNumber ?? '' })}
                          className="text-xs text-violet-600 hover:text-violet-800 underline"
                        >
                          {order.trackingNumber ?? '点击填写物流单号'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI reason */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">估价依据</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{order.reason}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {next && (
                      <button
                        onClick={() => handleAdvance(order)}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-sm"
                      >
                        推进至：{STATUS_LABELS[next]} →
                      </button>
                    )}
                    {order.status === 'paid' && (
                      <button
                        onClick={() => removeOrder(order.id)}
                        className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        删除订单
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

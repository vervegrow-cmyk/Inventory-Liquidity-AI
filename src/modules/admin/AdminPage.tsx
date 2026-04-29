import { useState } from 'react';
import type { InquiryStatus } from '../../types/inquiry';
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS } from '../../types/inquiry';
import { useInquiryStore } from '../../stores/inquiryStore';
import { InquiryDetailPage } from './InquiryDetailPage';

interface Props {
  onBack: () => void;
}

export function AdminPage({ onBack }: Props) {
  const inquiries = useInquiryStore(s => s.inquiries);
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? inquiries.find(q => q.id === selectedId) ?? null : null;

  if (selected) {
    return (
      <InquiryDetailPage
        inquiry={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const filtered = filterStatus === 'all' ? inquiries : inquiries.filter(q => q.status === filterStatus);

  const counts: Record<InquiryStatus | 'all', number> = {
    all:              inquiries.length,
    new:              inquiries.filter(q => q.status === 'new').length,
    quoted:           inquiries.filter(q => q.status === 'quoted').length,
    pending_recovery: inquiries.filter(q => q.status === 'pending_recovery').length,
    accepted:         inquiries.filter(q => q.status === 'accepted').length,
    rejected:         inquiries.filter(q => q.status === 'rejected').length,
    processing:       inquiries.filter(q => q.status === 'processing').length,
    completed:        inquiries.filter(q => q.status === 'completed').length,
  };

  if (!inquiries.length) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">📬</div>
        <p className="text-lg font-bold text-slate-800">暂无询价记录</p>
        <p className="text-sm text-slate-500 mt-1">用户提交清仓询价后，在这里查看所有记录</p>
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
          <h2 className="text-xl font-bold text-[#0f172a]">询价后台</h2>
          <p className="text-sm text-slate-500 mt-0.5">{inquiries.length} 条询价记录</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          ← 返回估价
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'new', 'quoted', 'accepted'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterStatus === s
                ? 'bg-[#0f172a] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {s === 'all' ? `全部 (${counts.all})` : `${INQUIRY_STATUS_LABELS[s as InquiryStatus]} (${counts[s as InquiryStatus]})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(inquiry => {
          const products = inquiry.products ?? [];
          return (
            <button
              key={inquiry.id}
              onClick={() => setSelectedId(inquiry.id)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all overflow-hidden"
            >
              <div className="p-4 flex items-start gap-4">
                <div className="flex -space-x-2 flex-shrink-0">
                  {products.slice(0, 3).map((p, i) => {
                    const thumb = p.images?.[0] ?? p.thumbnail ?? null;
                    const label = p.title ?? p.name ?? '?';
                    return thumb ? (
                      <img key={i} src={thumb} alt={label}
                        className="w-10 h-10 rounded-xl object-cover border-2 border-white"
                        style={{ zIndex: 3 - i }}
                      />
                    ) : (
                      <div key={i} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-base border-2 border-white" style={{ zIndex: 3 - i }}>📦</div>
                    );
                  })}
                  {products.length > 3 && (
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white">
                      +{products.length - 3}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 text-sm">{inquiry.userName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${INQUIRY_STATUS_COLORS[inquiry.status]}`}>
                      {INQUIRY_STATUS_LABELS[inquiry.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{inquiry.contact}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">商品数量</p>
                      <p className="text-sm font-bold text-slate-700">{products.length} 件</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">总估价</p>
                      <p className="text-sm font-bold text-violet-700">${inquiry.estimatedTotal.toLocaleString()}</p>
                    </div>
                    <div className="ml-auto">
                      <p className="text-[10px] text-slate-400">{new Date(inquiry.createdAt).toLocaleDateString('zh-CN')}</p>
                    </div>
                  </div>
                </div>

                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className={`h-1 w-full ${
                inquiry.status === 'new' ? 'bg-amber-400' :
                inquiry.status === 'quoted' ? 'bg-blue-400' :
                inquiry.status === 'accepted' ? 'bg-emerald-400' : 'bg-slate-200'
              }`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

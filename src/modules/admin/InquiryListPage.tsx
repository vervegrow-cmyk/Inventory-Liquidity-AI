import { useNavigate } from 'react-router-dom';
import type { Inquiry, InquiryStatus } from '../../types/inquiry';
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS } from '../../types/inquiry';
import { useAdminData } from './AdminLayout';

export function InquiryListPage() {
  const { inquiries, loading, handleStatusChange } = useAdminData();
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">正在加载询价数据...</p>
    </div>
  );

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl mx-auto mb-5">📭</div>
        <p className="text-xl font-bold text-slate-700">暂无询价记录</p>
        <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">客户在前台提交回收询价后，将在此显示并可进行出价、跟进等操作</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['用户', '联系方式', '商品', '估值', '状态', '时间', '操作'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inquiries.map(inq => (
                <InquiryRow
                  key={inq.id}
                  inquiry={inq}
                  onView={() => navigate(`/admin/inquiries/${inq.id}`)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InquiryRow({
  inquiry: inq, onView, onStatusChange,
}: {
  inquiry: Inquiry;
  onView: () => void;
  onStatusChange: (id: string, status: InquiryStatus) => void;
}) {
  const products = inq.products ?? [];
  const firstThumb = products[0]?.images?.[0] ?? products[0]?.thumbnail ?? null;
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-semibold text-slate-900 text-sm">{inq.userName}</p>
      </td>
      <td className="px-5 py-3.5 text-sm text-slate-500">{inq.contact}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-xs font-bold text-slate-700">{products.length}</span>
          {firstThumb && <img src={firstThumb} alt="" className="w-6 h-6 rounded-md border border-slate-200 object-cover ml-1" />}
        </div>
      </td>
      <td className="px-5 py-3.5 font-bold text-violet-700 text-sm">¥{(inq.estimatedTotal ?? 0).toLocaleString()}</td>
      <td className="px-5 py-3.5">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[inq.status]}`}>
          {INQUIRY_STATUS_LABELS[inq.status]}
        </span>
      </td>
      <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(inq.createdAt).toLocaleDateString('zh-CN')}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button onClick={onView} className="text-blue-600 hover:text-blue-700 text-xs font-semibold">查看 →</button>
          {inq.status === 'new' && (
            <button onClick={() => onStatusChange(inq.id, 'quoted')} className="text-xs text-slate-500 hover:text-slate-800">已出价</button>
          )}
        </div>
      </td>
    </tr>
  );
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import type { Inquiry, InquiryStatistics, InquiryStatus } from '../../types/inquiry';
import { getInquiries, getStatistics, updateInquiryStatus, deleteInquiry } from '../../services/inquiryApi';
import { useAuthStore } from '../../stores/authStore';
import { LoginPage } from '../auth/LoginPage';

// ── Data context shared by all admin sub-pages ────────────────────────────────

interface AdminData {
  inquiries: Inquiry[];
  statistics: InquiryStatistics;
  loading: boolean;
  loadError: string;
  loadData: () => void;
  handleStatusChange: (id: string, status: InquiryStatus) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

const AdminDataContext = createContext<AdminData | null>(null);

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside AdminLayout');
  return ctx;
}

// ── StatBadge ─────────────────────────────────────────────────────────────────

function StatBadge({ label, value, cls, dot }: { label: string; value: number; cls: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
      {label}
      <span className="font-bold">{value}</span>
    </span>
  );
}

// ── AdminLayout ───────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [statistics, setStatistics] = useState<InquiryStatistics>({
    total: 0, new: 0, quoted: 0, pending_recovery: 0, accepted: 0, rejected: 0, processing: 0, completed: 0, totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [inquiryRes, statsRes] = await Promise.all([getInquiries(), getStatistics()]);
      if (inquiryRes.success) setInquiries(inquiryRes.data.inquiries || []);
      else setLoadError(inquiryRes.error?.message || '加载失败');
      if (statsRes.success) setStatistics(statsRes.data);
    } catch {
      setLoadError('无法连接到后端，请确认数据库已配置或本地服务器已启动');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = useCallback(async (id: string, status: InquiryStatus) => {
    try {
      const res = await updateInquiryStatus(id, status);
      if (res.success) {
        setInquiries(prev => prev.map(q => q.id === id ? { ...q, status } : q));
        loadData();
      }
    } catch (err) { console.error('更新状态失败:', err); }
  }, [loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await deleteInquiry(id);
      if (res.success) {
        setInquiries(prev => prev.filter(q => q.id !== id));
        navigate('/admin/customers');
        loadData();
      }
    } catch (err) { console.error('删除失败:', err); }
  }, [loadData, navigate]);

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <AdminDataContext.Provider value={{ inquiries, statistics, loading, loadError, loadData, handleStatusChange, handleDelete }}>
      {/* Admin TopBar */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">询价管理后台</h1>
            <p className="text-xs text-slate-500 mt-0.5">回收商巡检 · 按询价人和商品管理清仓询价</p>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <NavLink to="/admin/customers" className={navCls}>🗂 客户目录</NavLink>
              <NavLink to="/admin/inquiries" className={navCls}>📋 询价列表</NavLink>
            </nav>
            <div className="text-right border-l border-slate-200 pl-3">
              <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-1 flex-wrap">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 w-20 bg-slate-100 rounded-full animate-pulse mx-1" />
            ))
          ) : (
            <>
              <StatBadge label="全部" value={statistics.total} cls="bg-slate-100 text-slate-700" />
              <StatBadge label="待处理" value={statistics.new} cls={statistics.new > 0 ? "bg-amber-100 text-amber-700 font-bold" : "bg-slate-50 text-slate-400"} dot={statistics.new > 0} />
              <StatBadge label="已出价" value={statistics.quoted} cls="bg-blue-50 text-blue-700" />
              <StatBadge label="待回收" value={statistics.pending_recovery} cls={statistics.pending_recovery > 0 ? "bg-purple-100 text-purple-700 font-bold" : "bg-slate-50 text-slate-400"} dot={statistics.pending_recovery > 0} />
              <StatBadge label="已确认" value={statistics.accepted} cls="bg-emerald-50 text-emerald-700" />
              <StatBadge label="处理中" value={statistics.processing} cls="bg-indigo-50 text-indigo-700" />
              <StatBadge label="已完成" value={statistics.completed} cls="bg-slate-50 text-slate-500" />
              <span className="ml-auto text-xs font-bold text-violet-700 flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-normal">总估值</span>
                ¥{statistics.totalValue >= 10000
                  ? `${(statistics.totalValue / 10000).toFixed(1)}万`
                  : statistics.totalValue.toLocaleString()}
              </span>
              <button
                onClick={loadData}
                title="刷新数据"
                className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm leading-none"
              >
                ↻
              </button>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="max-w-7xl mx-auto px-6 pt-5">
          <div className="px-5 py-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">后端连接失败</p>
              <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
              <p className="text-xs text-slate-500 mt-1.5">本地开发：请确保已运行 <code className="bg-red-100 px-1 py-0.5 rounded text-red-700 font-mono">npm run dev</code>（同时启动 Vite + 后端服务器）</p>
            </div>
            <button onClick={loadData} className="text-xs text-red-600 hover:text-red-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0">
              重试
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </div>
    </AdminDataContext.Provider>
  );
}

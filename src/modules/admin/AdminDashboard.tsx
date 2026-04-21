import { useState, useEffect, useMemo } from 'react';
import type {
  Inquiry, InquiryProduct, InquiryStatus, InquiryStatistics,
  ShippingMethod, ProductCondition, PricingBreakdown,
} from '../../types/inquiry';
import {
  INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS,
  PRODUCT_CONDITION_LABELS, PRODUCT_CONDITION_COLORS,
  SHIPPING_METHOD_LABELS, SHIPPING_METHOD_ICONS,
} from '../../types/inquiry';
import { getInquiries, getStatistics, updateInquiryStatus, deleteInquiry } from '../../services/inquiryApi';
import { useAuthStore } from '../../stores/authStore';
import { InquiryDetailPage } from './InquiryDetailPage';

interface CustomerGroup {
  key: string;
  userName: string;
  contact: string;
  inquiries: Inquiry[];
  totalProducts: number;
  totalValue: number;
  latestAt: string;
  hasNew: boolean;
}

type ViewMode = 'list' | 'directory';

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeProduct(p: InquiryProduct): InquiryProduct & {
  _title: string; _thumbnail: string | null; _price: number; _qty: number; _condition: ProductCondition;
} {
  const _title = p.title ?? p.name ?? '未知商品';
  const _thumbnail = p.images?.[0] ?? p.thumbnail ?? null;
  const _price = typeof p.estimatedPrice === 'number'
    ? p.estimatedPrice
    : parseFloat(String(p.estimatedPrice ?? '0').replace(/[^0-9.]/g, '')) || 0;
  const _qty = p.quantity ?? 1;
  const _condition: ProductCondition = (p.condition as ProductCondition) ?? 'used';
  return { ...p, _title, _thumbnail, _price, _qty, _condition };
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [statistics, setStatistics] = useState<InquiryStatistics>({
    total: 0, new: 0, quoted: 0, pending_recovery: 0, accepted: 0, rejected: 0, processing: 0, completed: 0, totalValue: 0,
  });
  const [filterStatus, setFilterStatus] = useState<InquiryStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('admin_viewMode') as ViewMode) || 'directory'
  );
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(() =>
    localStorage.getItem('admin_selectedCustomer')
  );
  const [expandedInquiries, setExpandedInquiries] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuthStore();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { localStorage.setItem('admin_viewMode', viewMode); }, [viewMode]);
  useEffect(() => {
    if (selectedCustomerKey) localStorage.setItem('admin_selectedCustomer', selectedCustomerKey);
    else localStorage.removeItem('admin_selectedCustomer');
  }, [selectedCustomerKey]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [inquiryRes, statsRes] = await Promise.all([getInquiries(), getStatistics()]);
      if (inquiryRes.success) {
        setInquiries(inquiryRes.data.inquiries || []);
      } else {
        setLoadError(inquiryRes.error?.message || '加载询价列表失败');
      }
      if (statsRes.success) setStatistics(statsRes.data);
    } catch (err) {
      console.error('加载数据失败:', err);
      setLoadError('无法连接到后端服务，请确认数据库已配置（Upstash Redis）或本地开发服务器已启动');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: InquiryStatus) => {
    try {
      const res = await updateInquiryStatus(id, status);
      if (res.success) {
        setInquiries(prev => prev.map(q => q.id === id ? { ...q, status } : q));
        loadData(); // refresh stats
      }
    } catch (err) {
      console.error('更新状态失败:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteInquiry(id);
      if (res.success) {
        setInquiries(prev => prev.filter(q => q.id !== id));
        setSelectedId(null);
        loadData();
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const customerGroups = useMemo((): CustomerGroup[] => {
    const map = new Map<string, CustomerGroup>();
    for (const inq of inquiries) {
      const key = `${inq.userName}__${inq.contact}`;
      if (!map.has(key)) {
        map.set(key, {
          key, userName: inq.userName, contact: inq.contact,
          inquiries: [], totalProducts: 0, totalValue: 0,
          latestAt: inq.createdAt, hasNew: false,
        });
      }
      const g = map.get(key)!;
      g.inquiries.push(inq);
      g.totalProducts += inq.products?.length ?? 0;
      g.totalValue += inq.estimatedTotal ?? 0;
      if (inq.createdAt > g.latestAt) g.latestAt = inq.createdAt;
      if (inq.status === 'new' || inq.status === 'quoted') g.hasNew = true;
    }
    return Array.from(map.values()).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [inquiries]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customerGroups.filter(g => {
      const matchSearch = !q || g.userName.toLowerCase().includes(q) || g.contact.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || g.inquiries.some(inq => inq.status === filterStatus);
      return matchSearch && matchStatus;
    });
  }, [customerGroups, searchQuery, filterStatus]);

  const filteredList = filterStatus === 'all' ? inquiries : inquiries.filter(q => q.status === filterStatus);

  const selected = selectedId ? inquiries.find(q => q.id === selectedId) : null;
  if (selected) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar user={user} onLogout={logout} />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <InquiryDetailPage
            inquiry={selected}
            onBack={() => setSelectedId(null)}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar user={user} onLogout={logout} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loadError && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">后端连接失败</p>
              <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
            </div>
            <button onClick={loadData} className="text-xs text-red-600 hover:text-red-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0">
              重试
            </button>
          </div>
        )}
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard title="总询价" value={statistics.total} icon="📊" color="bg-blue-50 border-blue-100" />
          <StatCard title="待估价" value={statistics.new} icon="📬" color="bg-amber-50 border-amber-100" highlight={statistics.new > 0} />
          <StatCard title="已出价" value={statistics.quoted} icon="💡" color="bg-indigo-50 border-indigo-100" />
          <StatCard title="已接受" value={statistics.accepted} icon="🤝" color="bg-emerald-50 border-emerald-100" />
          <StatCard title="总估值" value={`¥${(statistics.totalValue / 10000).toFixed(1)}万`} icon="💰" color="bg-violet-50 border-violet-100" />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-3 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('directory')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'directory' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              🗂 目录视图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              📋 列表视图
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">筛选:</span>
            {(['all', 'new', 'quoted', 'accepted', 'processing'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === s
                    ? 'bg-slate-900 text-white'
                    : s === 'all'
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : `${INQUIRY_STATUS_COLORS[s as InquiryStatus]} hover:opacity-80`
                }`}
              >
                {s === 'all'
                  ? `全部 (${statistics.total})`
                  : `${INQUIRY_STATUS_LABELS[s as InquiryStatus]} (${statistics[s as keyof InquiryStatistics] ?? 0})`}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">加载中...</div>
        ) : viewMode === 'directory' ? (
          <DirectoryView
            customers={filteredCustomers}
            selectedKey={selectedCustomerKey}
            onSelectCustomer={setSelectedCustomerKey}
            expandedInquiries={expandedInquiries}
            onToggleInquiry={(id) => {
              setExpandedInquiries(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              });
            }}
            onViewDetail={setSelectedId}
            onStatusChange={handleStatusChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        ) : (
          <ListView inquiries={filteredList} onView={setSelectedId} onStatusChange={handleStatusChange} />
        )}
      </div>
    </div>
  );
}

// ── Directory View ─────────────────────────────────────────────────────────────

interface DirectoryViewProps {
  customers: CustomerGroup[];
  selectedKey: string | null;
  onSelectCustomer: (key: string) => void;
  expandedInquiries: Set<string>;
  onToggleInquiry: (id: string) => void;
  onViewDetail: (id: string) => void;
  onStatusChange: (id: string, status: InquiryStatus) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function DirectoryView({
  customers, selectedKey, onSelectCustomer,
  expandedInquiries, onToggleInquiry, onViewDetail, onStatusChange,
  searchQuery, onSearchChange,
}: DirectoryViewProps) {
  const selectedCustomer = selectedKey ? customers.find(g => g.key === selectedKey) : null;

  if (customers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">📭</div>
        <p className="text-lg font-bold text-slate-700">暂无询价记录</p>
        <p className="text-sm text-slate-400 mt-1">客户提交询价后将在此显示</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start">
      {/* Left: customer list */}
      <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索客户名称或联系方式..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 pl-1">{customers.length} 位客户</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[600px]">
          {customers.map(g => (
            <button
              key={g.key}
              onClick={() => onSelectCustomer(g.key)}
              className={`w-full text-left px-3 py-3 border-b border-slate-50 transition-all ${
                selectedKey === g.key
                  ? 'bg-violet-50 border-l-2 border-l-violet-500'
                  : 'hover:bg-slate-50 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  selectedKey === g.key ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {g.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-semibold truncate ${selectedKey === g.key ? 'text-violet-800' : 'text-slate-800'}`}>
                      {g.userName}
                    </p>
                    {g.hasNew && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{g.contact}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500">{g.inquiries.length}次询价</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] text-slate-500">{g.totalProducts}件商品</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] font-semibold text-violet-600">¥{g.totalValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 min-w-0">
        {selectedCustomer ? (
          <CustomerInquiryPanel
            customer={selectedCustomer}
            expandedInquiries={expandedInquiries}
            onToggleInquiry={onToggleInquiry}
            onViewDetail={onViewDetail}
            onStatusChange={onStatusChange}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 h-64 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">👈</div>
            <p className="text-sm font-semibold text-slate-600">从左侧选择客户</p>
            <p className="text-xs text-slate-400">查看该客户的所有询价和商品明细</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Customer Inquiry Panel ─────────────────────────────────────────────────────

interface CustomerInquiryPanelProps {
  customer: CustomerGroup;
  expandedInquiries: Set<string>;
  onToggleInquiry: (id: string) => void;
  onViewDetail: (id: string) => void;
  onStatusChange: (id: string, status: InquiryStatus) => void;
}

function CustomerInquiryPanel({ customer, expandedInquiries, onToggleInquiry, onViewDetail, onStatusChange }: CustomerInquiryPanelProps) {
  const [activeTab, setActiveTab] = useState<'inquiries' | 'catalog'>('inquiries');

  const allProducts = useMemo(() => {
    const seen = new Map<string, { name: string; category: string; thumbnail: string | null; count: number; totalPrice: number; inquiryIds: string[] }>();
    for (const inq of customer.inquiries) {
      for (const p of (inq.products ?? [])) {
        const np = normalizeProduct(p);
        const key = `${np._title}__${p.category ?? ''}`;
        if (seen.has(key)) {
          const e = seen.get(key)!;
          e.count += np._qty;
          e.totalPrice += np._price * np._qty;
          if (!e.inquiryIds.includes(inq.id)) e.inquiryIds.push(inq.id);
        } else {
          seen.set(key, {
            name: np._title,
            category: p.category ?? '',
            thumbnail: np._thumbnail,
            count: np._qty,
            totalPrice: np._price * np._qty,
            inquiryIds: [inq.id],
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [customer]);

  return (
    <div className="space-y-4">
      {/* Customer summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {customer.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{customer.userName}</p>
              <p className="text-sm text-slate-500">{customer.contact}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900">{customer.inquiries.length}</p>
              <p className="text-xs text-slate-400">次询价</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-xl font-bold text-slate-900">{customer.totalProducts}</p>
              <p className="text-xs text-slate-400">件商品</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-xl font-bold text-violet-700">¥{customer.totalValue.toLocaleString()}</p>
              <p className="text-xs text-slate-400">总估值</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          {(['new', 'quoted', 'accepted', 'processing'] as const).map(s => {
            const count = customer.inquiries.filter(q => q.status === s).length;
            if (count === 0) return null;
            return (
              <span key={s} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[s]}`}>
                {INQUIRY_STATUS_LABELS[s]} {count}
              </span>
            );
          })}
          <span className="text-xs text-slate-400 ml-1">
            最近活跃：{new Date(customer.latestAt).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'inquiries' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          📋 询价记录 ({customer.inquiries.length})
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'catalog' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          📦 商品目录 ({allProducts.length})
        </button>
      </div>

      {/* Inquiry records */}
      {activeTab === 'inquiries' && (
        <div className="space-y-3">
          {customer.inquiries
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(inq => {
              const expanded = expandedInquiries.has(inq.id);
              const products = (inq.products ?? []).map(normalizeProduct);
              const shippingMethod = inq.acceptedShippingMethod as ShippingMethod | undefined;

              return (
                <div key={inq.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => onToggleInquiry(inq.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">
                          {new Date(inq.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[inq.status]}`}>
                          {INQUIRY_STATUS_LABELS[inq.status]}
                        </span>
                        {shippingMethod && (
                          <span className="text-xs text-slate-500">
                            {SHIPPING_METHOD_ICONS[shippingMethod]} {SHIPPING_METHOD_LABELS[shippingMethod]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {products.length} 件商品 · 估值 <span className="font-semibold text-violet-700">¥{(inq.estimatedTotal ?? 0).toLocaleString()}</span>
                      </p>
                    </div>
                    {/* Thumbnail strip */}
                    <div className="flex -space-x-1.5 flex-shrink-0">
                      {products.slice(0, 4).map((p, i) => (
                        <div key={i} className="w-7 h-7 rounded-lg border-2 border-white overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                          {p._thumbnail
                            ? <img src={p._thumbnail} alt={p._title} className="w-full h-full object-cover" />
                            : <span className="text-xs">📦</span>}
                        </div>
                      ))}
                      {products.length > 4 && (
                        <div className="w-7 h-7 rounded-lg border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                          +{products.length - 4}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onViewDetail(inq.id); }}
                      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      详情 →
                    </button>
                  </button>

                  {/* Expanded: product cards + actions */}
                  {expanded && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                      {/* Shipping method badge */}
                      {shippingMethod && (
                        <ShippingMethodBadge method={shippingMethod} />
                      )}

                      {/* Inquiry summary bar */}
                      <InquirySummaryBar
                        productCount={products.length}
                        totalValue={inq.estimatedTotal ?? 0}
                        status={inq.status}
                      />

                      {/* Product cards grid */}
                      {products.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {products.map((p, i) => (
                            <ProductCard key={p.id ?? i} product={p} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-4">暂无商品信息</p>
                      )}

                      {/* Quick actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {inq.status === 'new' && (
                          <button
                            onClick={() => onStatusChange(inq.id, 'quoted')}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                          >
                            💡 标记已出价
                          </button>
                        )}
                        {inq.status === 'quoted' && (
                          <button
                            onClick={() => onStatusChange(inq.id, 'accepted')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                          >
                            🤝 标记已接受
                          </button>
                        )}
                        {inq.status === 'accepted' && (
                          <button
                            onClick={() => onStatusChange(inq.id, 'processing')}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                          >
                            🚀 开始处理
                          </button>
                        )}
                        <button
                          onClick={() => onViewDetail(inq.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors ml-auto"
                        >
                          查看完整详情 →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Product catalog */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            {customer.userName} 的商品目录 — 共 {allProducts.length} 类
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                  {p.thumbnail
                    ? <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{p.category}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.count > 1 && <span className="text-[10px] text-blue-600 font-semibold">×{p.count}</span>}
                    {p.totalPrice > 0 && <span className="text-[10px] font-bold text-violet-700">¥{p.totalPrice.toLocaleString()}</span>}
                    <span className="text-[10px] text-slate-400">{p.inquiryIds.length}次询价</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

type NormalizedProduct = InquiryProduct & {
  _title: string; _thumbnail: string | null; _price: number; _qty: number; _condition: ProductCondition;
};

function ProductCard({ product }: { product: NormalizedProduct }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { _title, _thumbnail, _price, _qty, _condition, pricingReason } = product;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white hover:shadow-md transition-shadow flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-slate-100">
        {_thumbnail
          ? <img src={_thumbnail} alt={_title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
        <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${PRODUCT_CONDITION_COLORS[_condition]}`}>
          {PRODUCT_CONDITION_LABELS[_condition]}
        </span>
        {_qty > 1 && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            ×{_qty}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-xs font-semibold text-slate-900 truncate leading-snug">{_title}</p>
        {product.category && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{product.category}{product.brand ? ` · ${product.brand}` : ''}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-[10px] text-slate-400">×{_qty}</span>
          <span className={`text-sm font-bold ${_price > 0 ? 'text-violet-700' : 'text-slate-400'}`}>
            {_price > 0 ? `¥${_price.toLocaleString()}` : '待估价'}
          </span>
        </div>

        {pricingReason && (
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
          >
            <svg className={`w-3 h-3 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showBreakdown ? '收起依据' : '估价依据'}
          </button>
        )}

        {showBreakdown && pricingReason && (
          <PricingBreakdownPanel reason={pricingReason} />
        )}
      </div>
    </div>
  );
}

// ── Pricing Breakdown Panel ───────────────────────────────────────────────────

function PricingBreakdownPanel({ reason }: { reason: PricingBreakdown | string }) {
  if (typeof reason === 'string') {
    return (
      <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-[10px] text-slate-600 leading-relaxed">{reason}</p>
      </div>
    );
  }

  const rows: Array<{ label: string; value: number; highlight?: boolean }> = [
    { label: '市场参考价', value: reason.marketReference },
    { label: '成色调整', value: reason.conditionAdjustment },
    { label: '批量折扣', value: -Math.abs(reason.bulkDiscount) },
    { label: 'AI估价', value: reason.final, highlight: true },
  ].filter(r => r.value !== 0 || r.highlight);

  return (
    <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
      {rows.map(row => (
        <div key={row.label} className={`flex justify-between text-[10px] ${row.highlight ? 'font-bold border-t border-slate-200 pt-1 mt-1' : ''}`}>
          <span className={row.highlight ? 'text-slate-700' : 'text-slate-500'}>{row.label}</span>
          <span className={
            row.highlight ? 'text-violet-700' :
            row.value < 0 ? 'text-red-600' :
            row.value > 0 && !row.highlight ? 'text-emerald-600' :
            'text-slate-700'
          }>
            {row.value > 0 && !row.highlight ? '+' : ''}¥{Math.abs(row.value).toLocaleString()}
          </span>
        </div>
      ))}
      {reason.note && <p className="text-[9px] text-slate-400 italic pt-0.5">{reason.note}</p>}
    </div>
  );
}

// ── Inquiry Summary Bar ───────────────────────────────────────────────────────

function InquirySummaryBar({ productCount, totalValue, status }: { productCount: number; totalValue: number; status: InquiryStatus }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">{productCount}</span> 件商品
      </div>
      <div className="w-px h-3 bg-slate-300" />
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        总估值 <span className="font-bold text-violet-700">¥{totalValue.toLocaleString()}</span>
      </div>
      <div className="w-px h-3 bg-slate-300" />
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[status]}`}>
        {INQUIRY_STATUS_LABELS[status]}
      </span>
    </div>
  );
}

// ── Shipping Method Badge ─────────────────────────────────────────────────────

function ShippingMethodBadge({ method }: { method: ShippingMethod }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
      <span className="text-xl">{SHIPPING_METHOD_ICONS[method]}</span>
      <div>
        <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">客户已选配送方式</p>
        <p className="text-sm font-bold text-emerald-800">{SHIPPING_METHOD_LABELS[method]}</p>
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

interface ListViewProps {
  inquiries: Inquiry[];
  onView: (id: string) => void;
  onStatusChange: (id: string, status: InquiryStatus) => void;
}

function ListView({ inquiries, onView, onStatusChange }: ListViewProps) {
  if (inquiries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">📭</div>
        <p className="text-lg font-bold text-slate-700">暂无询价记录</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">用户</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">联系方式</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">商品</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">估值</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">状态</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">时间</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inquiries.map(inq => {
              const products = inq.products ?? [];
              const firstThumb = products[0]?.images?.[0] ?? products[0]?.thumbnail ?? null;
              return (
                <tr key={inq.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900 text-sm">{inq.userName}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{inq.contact}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-xs font-bold text-slate-700">{products.length}</span>
                      {firstThumb && (
                        <img src={firstThumb} alt="" className="w-6 h-6 rounded-md border border-slate-200 object-cover ml-1" />
                      )}
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
                      <button onClick={() => onView(inq.id)} className="text-blue-600 hover:text-blue-700 text-xs font-semibold">查看 →</button>
                      {inq.status === 'new' && (
                        <button onClick={() => onStatusChange(inq.id, 'quoted')} className="text-xs text-slate-500 hover:text-slate-800">已出价</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────────

function TopBar({ user, onLogout }: { user: { username: string; role: string } | null; onLogout: () => void }) {
  return (
    <div className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">询价管理后台</h1>
          <p className="text-xs text-slate-500 mt-0.5">回收商巡检 · 按询价人和商品管理清仓询价</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
          >
            登出
          </button>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  highlight?: boolean;
}

function StatCard({ title, value, icon, color, highlight }: StatCardProps) {
  return (
    <div className={`${color} rounded-xl border p-4 ${highlight ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs text-slate-500 mb-0.5">{title}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

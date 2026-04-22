import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Inquiry, InquiryProduct, ShippingMethod, ProductCondition } from '../../types/inquiry';
import {
  INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS,
  PRODUCT_CONDITION_LABELS, PRODUCT_CONDITION_COLORS,
  SHIPPING_METHOD_LABELS, SHIPPING_METHOD_ICONS,
} from '../../types/inquiry';
import { useAdminData } from './AdminLayout';

// ── types ────────────────────────────────────────────────────────────────────

interface CustomerGroup {
  key: string;
  userName: string;
  contact: string;
  address: string;
  inquiries: Inquiry[];
  totalProducts: number;
  totalValue: number;
  latestAt: string;
  hasNew: boolean;
  pendingRecoveryCount: number;
}

type NP = InquiryProduct & {
  _title: string; _thumbnail: string | null; _price: number; _qty: number; _condition: ProductCondition;
};

function normalizeProduct(p: InquiryProduct): NP {
  const _title = p.title ?? p.name ?? '未知商品';
  const _thumbnail = p.images?.[0] ?? p.thumbnail ?? null;
  const _price = typeof p.estimatedPrice === 'number'
    ? p.estimatedPrice
    : parseFloat(String(p.estimatedPrice ?? '0').replace(/[^0-9.]/g, '')) || 0;
  const _qty = p.quantity ?? 1;
  const _condition: ProductCondition = (p.condition as ProductCondition) ?? 'used';
  return { ...p, _title, _thumbnail, _price, _qty, _condition };
}

// ── CustomersPage ─────────────────────────────────────────────────────────────

export function CustomersPage() {
  const { inquiries, loading } = useAdminData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInquiries, setExpandedInquiries] = useState<Set<string>>(new Set());

  const selectedKey = searchParams.get('customer') ?? null;

  function selectCustomer(key: string) {
    setSearchParams({ customer: key });
  }

  const customerGroups = useMemo((): CustomerGroup[] => {
    const map = new Map<string, CustomerGroup>();
    for (const inq of inquiries) {
      const key = `${inq.userName}__${inq.contact}`;
      if (!map.has(key)) {
        map.set(key, {
          key, userName: inq.userName, contact: inq.contact,
          address: inq.address ?? '',
          inquiries: [], totalProducts: 0, totalValue: 0,
          latestAt: inq.createdAt, hasNew: false, pendingRecoveryCount: 0,
        });
      }
      const g = map.get(key)!;
      g.inquiries.push(inq);
      g.totalProducts += inq.products?.length ?? 0;
      g.totalValue += inq.estimatedTotal ?? 0;
      if (inq.createdAt > g.latestAt) g.latestAt = inq.createdAt;
      if (inq.status === 'new' || inq.status === 'quoted') g.hasNew = true;
      if (inq.status === 'pending_recovery') g.pendingRecoveryCount += 1;
      if (inq.address && !g.address) g.address = inq.address;
    }
    return Array.from(map.values()).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [inquiries]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return !q ? customerGroups : customerGroups.filter(g =>
      g.userName.toLowerCase().includes(q) || g.contact.toLowerCase().includes(q)
    );
  }, [customerGroups, searchQuery]);

  const selectedCustomer = selectedKey ? filteredCustomers.find(g => g.key === selectedKey) : null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">正在加载客户数据...</p>
    </div>
  );

  if (filteredCustomers.length === 0 && !searchQuery) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl mx-auto mb-5">📭</div>
        <p className="text-xl font-bold text-slate-700">暂无客户询价</p>
        <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">客户在前台填写姓名和联系方式并提交回收询价后，将按客户分组展示在这里</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-stretch min-h-[calc(100vh-280px)]">
      {/* Left: sidebar */}
      <SidebarLayout>
        {/* Search bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索客户名称或联系方式"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-slate-400"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 pl-0.5">{filteredCustomers.length} 位客户</p>
        </div>

        {/* Customer cards */}
        <CustomerList>
          {filteredCustomers.length === 0 && searchQuery ? (
            <div className="text-center py-8 text-slate-400 text-sm">未找到匹配客户</div>
          ) : (
            filteredCustomers.map(g => (
              <CustomerCard
                key={g.key}
                customer={g}
                isSelected={selectedKey === g.key}
                onClick={() => selectCustomer(g.key)}
              />
            ))
          )}
        </CustomerList>
      </SidebarLayout>

      {/* Right: customer detail */}
      <div className="flex-1 min-w-0">
        {selectedCustomer ? (
          <CustomerInquiryPanel
            customer={selectedCustomer}
            expandedInquiries={expandedInquiries}
            onToggleInquiry={id => setExpandedInquiries(prev => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })}
            onViewDetail={id => navigate(`/admin/inquiries/${id}`)}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">👈</div>
            <p className="text-sm font-semibold text-slate-600">从左侧选择客户</p>
            <p className="text-xs text-slate-400">查看该客户的所有询价和商品明细</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar layout components ─────────────────────────────────────────────────

function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-3 h-full">
      {children}
    </div>
  );
}

function CustomerList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-240px)]">
      {children}
    </div>
  );
}

function CustomerCard({ customer: g, isSelected, onClick }: {
  customer: CustomerGroup;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-l-4 transition-all shadow-sm hover:shadow-md ${
        isSelected
          ? 'bg-violet-50 border border-violet-200 border-l-violet-500 shadow-md'
          : 'bg-white border border-slate-200 border-l-transparent hover:border-slate-300'
      }`}
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 transition-colors ${
          isSelected ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
        }`}>
          {g.userName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-base font-semibold truncate leading-tight ${
              isSelected ? 'text-violet-900' : 'text-slate-800'
            }`}>
              {g.userName}
            </p>
            {g.hasNew && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </div>

          <p className="text-sm text-slate-500 truncate mt-0.5">{g.contact}</p>

          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs text-slate-400">{g.inquiries.length}次询价</span>
            <span className="text-slate-300 text-xs">|</span>
            <span className="text-xs font-semibold text-violet-600">
              ¥{g.totalValue.toLocaleString()}
            </span>
            {g.pendingRecoveryCount > 0 && (
              <span className="ml-auto text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">
                {g.pendingRecoveryCount}待回收
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── CustomerInquiryPanel ──────────────────────────────────────────────────────

function CustomerInquiryPanel({
  customer, expandedInquiries, onToggleInquiry, onViewDetail,
}: {
  customer: CustomerGroup;
  expandedInquiries: Set<string>;
  onToggleInquiry: (id: string) => void;
  onViewDetail: (id: string) => void;
}) {
  const { handleStatusChange } = useAdminData();
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
          seen.set(key, { name: np._title, category: p.category ?? '', thumbnail: np._thumbnail, count: np._qty, totalPrice: np._price * np._qty, inquiryIds: [inq.id] });
        }
      }
    }
    return Array.from(seen.values());
  }, [customer]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {customer.userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{customer.userName}</p>
              <p className="text-sm text-slate-500">{customer.contact}</p>
              {customer.address && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <span>📍</span>{customer.address}
                </p>
              )}
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
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {(['new', 'quoted', 'pending_recovery', 'accepted', 'processing'] as const).map(s => {
            const count = customer.inquiries.filter(q => q.status === s).length;
            if (count === 0) return null;
            return <span key={s} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[s]}`}>{INQUIRY_STATUS_LABELS[s]} {count}</span>;
          })}
          <span className="text-xs text-slate-400 ml-auto">最近活跃：{new Date(customer.latestAt).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
        <button onClick={() => setActiveTab('inquiries')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'inquiries' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          📋 询价记录 ({customer.inquiries.length})
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'catalog' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          📦 商品目录 ({allProducts.length})
        </button>
      </div>

      {activeTab === 'inquiries' && (
        <div className="space-y-3">
          {customer.inquiries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(inq => {
            const expanded = expandedInquiries.has(inq.id);
            const products = (inq.products ?? []).map(normalizeProduct);
            const shippingMethod = inq.acceptedShippingMethod as ShippingMethod | undefined;
            return (
              <div key={inq.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => onToggleInquiry(inq.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors">
                  <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{new Date(inq.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INQUIRY_STATUS_COLORS[inq.status]}`}>{INQUIRY_STATUS_LABELS[inq.status]}</span>
                      {shippingMethod && <span className="text-xs text-slate-500">{SHIPPING_METHOD_ICONS[shippingMethod]} {SHIPPING_METHOD_LABELS[shippingMethod]}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{products.length} 件商品</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold text-violet-700">¥{(inq.estimatedTotal ?? 0).toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    {products.slice(0, 4).map((p, i) => (
                      <div key={i} className="w-7 h-7 rounded-lg border-2 border-white overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {p._thumbnail ? <img src={p._thumbnail} alt={p._title} className="w-full h-full object-cover" /> : <span className="text-xs">📦</span>}
                      </div>
                    ))}
                    {products.length > 4 && <div className="w-7 h-7 rounded-lg border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">+{products.length - 4}</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); onViewDetail(inq.id); }} className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                    详情 →
                  </button>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    {shippingMethod && (
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-xl">{SHIPPING_METHOD_ICONS[shippingMethod]}</span>
                        <div>
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">客户已选配送方式</p>
                          <p className="text-sm font-bold text-emerald-800">{SHIPPING_METHOD_LABELS[shippingMethod]}</p>
                        </div>
                      </div>
                    )}
                    {products.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {products.map((p, i) => (
                          <MiniProductCard key={p.id ?? i} product={p} />
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400 text-center py-4">暂无商品信息</p>}
                    <div className="flex items-center gap-2 pt-1">
                      {inq.status === 'new' && <button onClick={() => handleStatusChange(inq.id, 'quoted')} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">💡 标记已出价</button>}
                      {inq.status === 'quoted' && <button onClick={() => handleStatusChange(inq.id, 'accepted')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">🤝 标记已接受</button>}
                      {inq.status === 'accepted' && <button onClick={() => handleStatusChange(inq.id, 'processing')} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">🚀 开始处理</button>}
                      <button onClick={() => onViewDetail(inq.id)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors ml-auto">查看完整详情 →</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{customer.userName} 的商品目录 — 共 {allProducts.length} 类</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                  {p.thumbnail ? <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
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

function MiniProductCard({ product }: { product: NP }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col">
      <div className="relative aspect-square bg-slate-100">
        {product._thumbnail ? <img src={product._thumbnail} alt={product._title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
        <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${PRODUCT_CONDITION_COLORS[product._condition]}`}>{PRODUCT_CONDITION_LABELS[product._condition]}</span>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-slate-900 truncate">{product._title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">×{product._qty}</span>
          <span className={`text-sm font-bold ${product._price > 0 ? 'text-violet-700' : 'text-slate-400'}`}>{product._price > 0 ? `¥${product._price.toLocaleString()}` : '待估价'}</span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Product, ChatMessage, ChatAttachment, PricingResult, Phase } from '../../types';
import { PriceCard } from '../components/PriceCard';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高 ✅', medium: '中 ⚠️', low: '低 ❓',
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.xlsx,.xls,.csv';

export interface ChatPanelProps {
  product: Product | null;
  messages: ChatMessage[];
  loading: boolean;
  result: PricingResult | null;
  error: string;
  userInput: string;
  phase: Phase;
  thumbnail?: string;
  compact?: boolean;
  fromSpreadsheet: boolean;
  onSendAnswer: () => void;
  onSendWithAttachments: (text: string, files: File[]) => void;
  onInputChange: (val: string) => void;
  onClose: () => void;
  onReset: () => void;
  onGoToSelect: () => void;
  onAcceptQuote?: () => void;
}

interface PendingPreview {
  file: File;
  type: 'image' | 'video' | 'spreadsheet';
  objectUrl: string;
  name: string;
}

export function ChatPanel({
  product, messages, loading, result, error, userInput,
  phase, thumbnail, compact = false, fromSpreadsheet,
  onSendAnswer, onSendWithAttachments, onInputChange, onClose, onReset, onGoToSelect, onAcceptQuote,
}: ChatPanelProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingPreview[]>([]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && !result) inputRef.current?.focus();
  }, [loading, result]);

  useEffect(() => {
    return () => {
      pending.forEach(p => { if (p.objectUrl) URL.revokeObjectURL(p.objectUrl); });
    };
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const previews: PendingPreview[] = files.map(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);
      const isVideo = ['mp4', 'mov', 'webm', 'quicktime'].includes(ext);
      const type = isSpreadsheet ? 'spreadsheet' : isVideo ? 'video' : 'image';
      const objectUrl = (type === 'image' || type === 'video') ? URL.createObjectURL(f) : '';
      return { file: f, type, objectUrl, name: f.name };
    });
    setPending(prev => [...prev, ...previews]);
    e.target.value = '';
  }

  function removePending(idx: number) {
    setPending(prev => {
      const next = [...prev];
      if (next[idx].objectUrl) URL.revokeObjectURL(next[idx].objectUrl);
      next.splice(idx, 1);
      return next;
    });
  }

  function handleSend() {
    if ((!userInput.trim() && pending.length === 0) || loading) return;
    if (pending.length > 0) {
      onSendWithAttachments(userInput, pending.map(p => p.file));
      pending.forEach(p => { if (p.objectUrl) URL.revokeObjectURL(p.objectUrl); });
      setPending([]);
    } else {
      onSendAnswer();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const canSend = (userInput.trim().length > 0 || pending.length > 0) && !loading;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col ${compact ? 'h-[640px]' : 'h-[640px]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-[#0f172a] rounded-t-2xl flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center text-base flex-shrink-0">📦</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{product?.name}</p>
          <p className="text-xs text-slate-400">{product?.category}</p>
        </div>
        {phase === 'select' ? (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-1">✕</button>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs text-slate-400">{result ? 'Done' : 'Analyzing'}</span>
          </div>
        )}
      </div>

      {result ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-white font-bold text-sm">估价完成</p>
              <p className="text-white/70 text-xs">{product?.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PriceCard label="收货价" value={result.estimated_price} accent="violet" />
            <PriceCard label="转售价" value={result.resale_price} accent="indigo" />
            <PriceCard label="快速出货" value={result.quick_sale_price} accent="slate" />
            <PriceCard label="置信度" value={CONFIDENCE_LABEL[result.confidence] ?? result.confidence} accent="slate" />
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">AI 分析</p>
            <p className="text-xs text-slate-700 leading-relaxed">{result.reason}</p>
          </div>
          {onAcceptQuote && (
            <button
              onClick={onAcceptQuote}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>✅</span> 同意报价 · 安排回收
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {phase === 'select' ? (
              <button onClick={onClose} className="py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:border-slate-300 transition-all">
                ← 其他产品
              </button>
            ) : fromSpreadsheet ? (
              <button onClick={onGoToSelect} className="py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold transition-all">
                ← Products
              </button>
            ) : (
              <button onClick={onReset} className="py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold transition-all">
                ↺ New
              </button>
            )}
            <button
              onClick={() => {
                const text = `Product: ${product?.name}\nPurchase: ${result.estimated_price}\nResale: ${result.resale_price}\nQuick Sale: ${result.quick_sale_price}`;
                navigator.clipboard.writeText(text);
              }}
              className="py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-sm"
            >
              Copy
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages
              .filter(m => m.role === 'assistant' || (m.role === 'user' && !m.content.startsWith('商品信息：')))
              .map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs flex-shrink-0 mb-0.5">🤖</div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl text-sm leading-relaxed overflow-hidden ${
                    msg.role === 'user'
                      ? msg.attachments?.length
                        ? 'bg-white border border-slate-200 text-slate-800 rounded-br-sm'
                        : 'bg-[#0f172a] text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {/* Attachments grid */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <AttachmentsGrid attachments={msg.attachments} />
                    )}
                    {/* Strip 【补充...】 tags — those are for AI context only */}
                    {(() => {
                      const display = msg.content.replace(/【补充(图片|视频|表格)[^】]*】/g, '').trim();
                      return display ? <p className="px-3.5 py-2">{display}</p> : null;
                    })()}
                  </div>
                </div>
              ))}
            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs flex-shrink-0">🤖</div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="flex gap-1">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl space-y-2 flex-shrink-0">
            {error && <p className="text-xs text-red-500 px-1">⚠️ {error}</p>}

            {/* Pending attachment previews */}
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {pending.map((p, idx) => (
                  <div key={idx} className="relative group">
                    {p.type === 'image' ? (
                      <img src={p.objectUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                    ) : p.type === 'video' ? (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex flex-col items-center justify-center border border-slate-600 gap-1">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        <span className="text-[9px] text-slate-300 truncate w-12 text-center">{p.name}</span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-green-50 flex flex-col items-center justify-center border border-green-200 gap-1 px-1">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="text-[9px] text-green-700 truncate w-12 text-center">{p.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removePending(idx)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center">
              {/* Attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="补充图片 / 视频 / 表格"
                className="flex-shrink-0 w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-slate-500 hover:text-violet-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pending.length > 0 ? '添加说明（可选）...' : 'Type your answer...'}
                disabled={loading}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="px-3.5 py-2.5 bg-[#0f172a] hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <span className="hidden sm:inline text-xs">Send</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AttachmentsGrid({ attachments }: { attachments: ChatAttachment[] }) {
  const media = attachments.filter(a => a.type === 'image' || a.type === 'video');
  const files = attachments.filter(a => a.type === 'spreadsheet');

  return (
    <div className="p-2 space-y-1.5">
      {media.length > 0 && (
        <div className={`grid gap-1 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {media.map((att, i) => (
            <img
              key={i}
              src={att.preview}
              alt={att.name}
              className="w-full h-28 object-cover rounded-lg"
            />
          ))}
        </div>
      )}
      {files.map((att, i) => (
        <SpreadsheetPreview key={i} att={att} />
      ))}
    </div>
  );
}

function SpreadsheetPreview({ att }: { att: ChatAttachment }) {
  const rows = att.rows ?? [];
  const images = att.images ?? [];
  const hasImages = images.length > 0;
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const visibleCols = hasImages ? 4 : 6;
  const visibleRows = 12;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white text-slate-800 text-xs min-w-[280px]">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-medium text-slate-700 truncate flex-1">{att.name}</span>
        <span className="text-slate-400 flex-shrink-0">{dataRows.length} 行{hasImages ? ` · ${images.length} 图` : ''}</span>
      </div>

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto max-h-56 overflow-y-auto">
          <table className="w-full border-collapse">
            {headers.length > 0 && (
              <thead>
                <tr className="bg-slate-100 sticky top-0 z-10">
                  {hasImages && (
                    <th className="px-2 py-1.5 text-left font-semibold text-slate-500 border-b border-slate-200 w-10">图</th>
                  )}
                  {headers.slice(0, visibleCols).map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap max-w-[100px] truncate">
                      {h || `列${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {dataRows.slice(0, visibleRows).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {hasImages && (
                    <td className="px-1.5 py-1 border-b border-slate-100 w-10">
                      {images[ri] ? (
                        <img src={images[ri]} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-300 text-[10px]">—</div>
                      )}
                    </td>
                  )}
                  {row.slice(0, visibleCols).map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-slate-700 border-b border-slate-100 whitespace-nowrap max-w-[100px] truncate">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dataRows.length > visibleRows && (
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-slate-400 text-center">
          还有 {dataRows.length - visibleRows} 行未显示
        </div>
      )}
    </div>
  );
}

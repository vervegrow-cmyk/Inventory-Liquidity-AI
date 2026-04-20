import { useState, useRef } from 'react';
import type { Phase, FileType, Product, SpreadsheetProduct, ChatMessage, PricingResult } from './types';
import { extractVideoFrame, parseSpreadsheet, extractExcelImages, extractProducts } from './lib/media';
import { callPricingApi } from './services/pricingApi';
import { callIdentifyApi } from './services/identifyApi';
import { ChatPanel } from './ui/blocks/ChatPanel';
import { PriceCard } from './ui/components/PriceCard';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高 ✅', medium: '中 ⚠️', low: '低 ❓',
};

export default function App() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileType, setFileType] = useState<FileType>('image');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [spreadsheetRows, setSpreadsheetRows] = useState<string[][]>([]);
  const [spreadsheetProducts, setSpreadsheetProducts] = useState<SpreadsheetProduct[]>([]);
  const [selectedSP, setSelectedSP] = useState<SpreadsheetProduct | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function revokeThumbnails(products: SpreadsheetProduct[]) {
    products.forEach(p => { if (p.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(p.thumbnail); });
  }

  function reset() {
    revokeThumbnails(spreadsheetProducts);
    setPhase('upload'); setFileType('image');
    setImageBase64(''); setImagePreview('');
    setSpreadsheetRows([]); setSpreadsheetProducts([]);
    setSelectedSP(null); setProduct(null);
    setMessages([]); setUserInput('');
    setResult(null); setError('');
    setUploadKey(k => k + 1);
  }

  function closeChatPanel() {
    setSelectedSP(null); setProduct(null);
    setMessages([]); setResult(null); setError('');
  }

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImageBase64(''); setImagePreview('');
    setSpreadsheetRows([]);
    revokeThumbnails(spreadsheetProducts);
    setSpreadsheetProducts([]);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isSpreadsheet = /\.(xlsx?|csv)$/i.test(file.name) ||
      file.type.includes('spreadsheet') || file.type === 'text/csv';

    if (isImage) {
      if (file.size > 10 * 1024 * 1024) { setError('图片不能超过 10MB'); return; }
      setFileType('image');
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setImagePreview(dataUrl); setImageBase64(dataUrl.split(',')[1]);
      };
      reader.readAsDataURL(file);
    } else if (isVideo) {
      setFileType('video'); setLoading(true);
      try {
        const { base64, preview } = await extractVideoFrame(file);
        setImageBase64(base64); setImagePreview(preview);
      } catch { setError('视频帧提取失败'); }
      finally { setLoading(false); }
    } else if (isSpreadsheet) {
      if (file.size > 20 * 1024 * 1024) { setError('表格文件不能超过 20MB'); return; }
      setFileType('spreadsheet'); setLoading(true);
      try {
        const [{ rows }, images] = await Promise.all([
          parseSpreadsheet(file),
          extractExcelImages(file),
        ]);
        setSpreadsheetRows(rows.slice(0, 6));
        const products = extractProducts(rows);
        products.forEach((p, i) => { if (images[i]) p.thumbnail = images[i]; });
        setSpreadsheetProducts(products);
      } catch { setError('表格解析失败，请检查文件格式'); }
      finally { setLoading(false); }
    } else {
      setError('不支持的文件格式，请上传图片、视频或表格');
    }
  }

  // ── Chat flow ──────────────────────────────────────────────────────────────

  async function startChat(initMessages: ChatMessage[], changePhase = true) {
    const data = await callPricingApi(initMessages);
    if (data.done) {
      setResult(data);
      setMessages([...initMessages, { role: 'assistant', content: data.reason }]);
      if (changePhase) setPhase('done');
    } else {
      setMessages([...initMessages, { role: 'assistant', content: data.reply }]);
      if (changePhase) setPhase('chatting');
    }
  }

  async function handleStartValuation() {
    if (loading) return;
    if (fileType === 'spreadsheet') {
      if (spreadsheetProducts.length > 0) { setPhase('select'); return; }
      setError('未能从表格中提取产品，请检查格式'); return;
    }
    if (!imageBase64) return;
    setLoading(true); setError('');
    try {
      const identified = await callIdentifyApi({ image: imageBase64 });
      setProduct(identified);
      await startChat([{
        role: 'user',
        content: `商品信息：名称=${identified.name}，类别=${identified.category}，品牌=${identified.brand}`,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请重试');
    } finally { setLoading(false); }
  }

  async function handleSelectProduct(sp: SpreadsheetProduct) {
    if (loading) return;
    setSelectedSP(sp);
    setProduct({ name: sp.name, category: sp.category, brand: sp.brand });
    setMessages([]); setResult(null); setError('');
    setLoading(true);
    try {
      await startChat([{
        role: 'user',
        content: `商品信息：${sp.rowText || `名称=${sp.name}，类别=${sp.category}，品牌=${sp.brand}`}`,
      }], false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请重试');
    } finally { setLoading(false); }
  }

  async function handleSendAnswer() {
    if (!userInput.trim() || loading) return;
    const answer = userInput.trim();
    setUserInput(''); setError('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: answer }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const data = await callPricingApi(newMessages);
      if (data.done) {
        setResult(data);
        setMessages([...newMessages, { role: 'assistant', content: data.reason }]);
        if (phase !== 'select') setPhase('done');
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试');
    } finally { setLoading(false); }
  }

  const hasFile = !!(imageBase64 || spreadsheetProducts.length > 0);
  const showSidebar = !!imagePreview;
  const fromSpreadsheet = spreadsheetProducts.length > 0;

  const chatPanelProps = {
    product, messages, loading, result, error, userInput, phase,
    thumbnail: selectedSP?.thumbnail || (imagePreview || undefined),
    fromSpreadsheet,
    onSendAnswer: handleSendAnswer,
    onInputChange: setUserInput,
    onClose: closeChatPanel,
    onReset: reset,
    onGoToSelect: () => { setPhase('select'); setSelectedSP(null); setMessages([]); setResult(null); },
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base shadow-md">📦</div>
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">
              Inventory Liquidity <span className="text-violet-400">AI</span>
            </span>
          </div>
          {phase !== 'upload' && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
            >
              <span>↺</span> New
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <div className="max-w-xl mx-auto" key={uploadKey}>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a]">Get Instant Valuation</h2>
              <p className="text-slate-500 mt-2 text-sm sm:text-base">
                Upload a photo, video, or spreadsheet — AI guides you to the best price.
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`relative transition-all duration-200 ${
                  hasFile ? 'bg-slate-50 cursor-pointer'
                    : loading ? 'cursor-wait'
                    : 'bg-gradient-to-b from-slate-50 to-white hover:from-violet-50/60 hover:to-white cursor-pointer'
                }`}
              >
                {imagePreview ? (
                  <div className="p-4">
                    <div className="relative inline-block w-full">
                      <img src={imagePreview} alt="Preview" className="mx-auto max-h-72 rounded-xl object-contain" />
                      {fileType === 'video' && (
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          Video frame
                        </div>
                      )}
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-3">Click to change</p>
                  </div>
                ) : spreadsheetProducts.length > 0 ? (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">找到 <span className="text-violet-600">{spreadsheetProducts.length}</span> 个产品</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="text-xs w-full">
                        <tbody>
                          {spreadsheetRows.map((row, i) => (
                            <tr key={i} className={i === 0 ? 'bg-slate-100 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              {row.slice(0, 6).map((cell, j) => (
                                <td key={j} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-600 max-w-[120px] truncate">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-3">Click to change</p>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center py-14">
                    <svg className="animate-spin h-8 w-8 text-violet-500 mb-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <p className="text-sm text-slate-500">Processing...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4 shadow-inner">
                      <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-base font-semibold text-slate-700">Drop your file here</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400">📷 Images</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">🎬 Videos</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">📊 Spreadsheets</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, MP4, XLSX, CSV · max 10 MB</p>
                  </div>
                )}
                {!hasFile && !loading && (
                  <div className="absolute inset-3 rounded-xl border-2 border-dashed border-slate-200 pointer-events-none" />
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*,video/*,.csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

              <div className="p-5 border-t border-slate-100 space-y-3">
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                    <span>⚠️</span> {error}
                  </div>
                )}
                <button
                  onClick={handleStartValuation}
                  disabled={!hasFile || loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Analyzing...</>
                  ) : fileType === 'spreadsheet' && spreadsheetProducts.length > 0 ? (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> Select Product ({spreadsheetProducts.length})</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Start Valuation</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: select ── */}
        {phase === 'select' && (
          <div className={`${selectedSP ? 'flex gap-5 items-start' : 'max-w-5xl mx-auto'}`}>
            <div className={selectedSP ? 'w-64 flex-shrink-0' : 'w-full'}>
              {!selectedSP && (
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a]">选择要估价的产品</h2>
                  <p className="text-slate-500 text-sm mt-1">共找到 {spreadsheetProducts.length} 个产品，点击任意一个开始 AI 估价</p>
                </div>
              )}
              {selectedSP && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Products ({spreadsheetProducts.length})</p>
                </div>
              )}
              {error && !selectedSP && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                  <span>⚠️</span> {error}
                </div>
              )}

              {!selectedSP && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {spreadsheetProducts.map((sp, i) => (
                    <button key={i} onClick={() => handleSelectProduct(sp)} disabled={loading}
                      className="text-left bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-lg shadow-sm overflow-hidden transition-all group disabled:opacity-50">
                      <div className="w-full aspect-square bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center relative">
                        {sp.thumbnail ? (
                          <img src={sp.thumbnail} alt={sp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-5xl opacity-20">📦</span>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold text-slate-800 text-sm group-hover:text-violet-700 transition-colors truncate">{sp.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 mb-3">{sp.category}</p>
                        <div className="space-y-1">
                          {Object.entries(sp.details).slice(0, 3).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <span className="text-xs text-slate-400 truncate max-w-[50%]">{k}</span>
                              <span className="text-xs font-medium text-slate-700 truncate">{v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-semibold text-violet-600 group-hover:text-violet-700">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Start Valuation →
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedSP && (
                <div className="space-y-1.5 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                  {spreadsheetProducts.map((sp, i) => (
                    <button key={i} onClick={() => handleSelectProduct(sp)} disabled={loading}
                      className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                        selectedSP === sp ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200'
                      }`}>
                      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                        {sp.thumbnail ? (
                          <img src={sp.thumbnail} alt={sp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base opacity-30">📦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${selectedSP === sp ? 'text-violet-700' : 'text-slate-800'}`}>{sp.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{sp.category}</p>
                      </div>
                      {selectedSP === sp && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSP && (
              <div className="flex-1 min-w-0">
                <ChatPanel {...chatPanelProps} compact />
              </div>
            )}
          </div>
        )}

        {/* ── Phase: chatting ── */}
        {phase === 'chatting' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {showSidebar && product && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-20">
                  <div className="relative">
                    <img src={imagePreview} alt={product.name} className="w-full aspect-square object-cover" />
                    {fileType === 'video' && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Video
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Product</p>
                      <p className="text-sm font-bold text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Brand</p>
                      <p className="text-sm font-medium text-slate-700">{product.brand}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                      <p className="text-xs text-slate-500">AI Appraisal in progress</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className={`${showSidebar ? 'lg:col-span-2' : 'lg:col-span-3'} w-full`}>
              <ChatPanel {...chatPanelProps} />
            </div>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {showSidebar && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-20">
                  <div className="relative">
                    <img src={imagePreview} alt={product?.name} className="w-full aspect-square object-cover" />
                    {fileType === 'video' && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Video
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-slate-800">{product?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{product?.brand} · {product?.category}</p>
                  </div>
                </div>
              </div>
            )}
            <div className={`${showSidebar ? 'lg:col-span-2' : 'lg:col-span-3'} w-full space-y-4`}>
              <div className="bg-[#0f172a] rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg">✅</div>
                <div>
                  <p className="text-white font-bold text-lg">Appraisal Complete</p>
                  {product && <p className="text-slate-400 text-sm">{product.name}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PriceCard label="Purchase Price" value={result.estimated_price} accent="violet" />
                <PriceCard label="Resale Price" value={result.resale_price} accent="indigo" />
                <PriceCard label="Quick Sale" value={result.quick_sale_price} accent="slate" />
                <PriceCard label="Confidence" value={CONFIDENCE_LABEL[result.confidence] ?? result.confidence} accent="slate" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">AI Analysis</p>
                <p className="text-sm text-slate-700 leading-relaxed">{result.reason}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={reset} className="py-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-sm font-semibold transition-all">
                  ↺ New Appraisal
                </button>
                <button
                  onClick={() => {
                    const text = `Product: ${product?.name}\nPurchase: ${result.estimated_price}\nResale: ${result.resale_price}\nQuick Sale: ${result.quick_sale_price}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md"
                >
                  Copy Results
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

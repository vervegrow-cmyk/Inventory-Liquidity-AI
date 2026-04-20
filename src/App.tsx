import { useState, useRef } from 'react';
import type { Phase, FileType, Product, SpreadsheetProduct, ChatMessage, ChatAttachment, PricingResult, UploadedImage, ProductGroup } from './types';
import { extractVideoFrame, parseSpreadsheet, extractExcelImages, extractProducts, compressImageBase64 } from './lib/media';
import { callPricingApi } from './services/pricingApi';
import { callIdentifyApi } from './services/identifyApi';
import { callGroupApi } from './services/groupApi';
import { ChatPanel } from './ui/blocks/ChatPanel';
import { PriceCard } from './ui/components/PriceCard';
import { RecoveryMethodModal } from './modules/recovery/RecoveryMethodModal';
import { RecoveryCartPage } from './modules/recovery/RecoveryCartPage';
import { RecoveryOrderListPage } from './modules/recovery/RecoveryOrderListPage';
import { useRecoveryStore } from './stores/recoveryStore';

type AppView = 'valuation' | 'cart' | 'orders';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高 ✅', medium: '中 ⚠️', low: '低 ❓',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isSpreadsheetFile(file: File): boolean {
  return /\.(xlsx?|csv)$/i.test(file.name) || file.type.includes('spreadsheet') || file.type === 'text/csv';
}

export default function App() {
  const [appView, setAppView] = useState<AppView>('valuation');
  const [showMethodModal, setShowMethodModal] = useState(false);
  const cartCount = useRecoveryStore(s => s.cart.length);
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileType, setFileType] = useState<FileType>('image');

  // Single-image / video state (also used as "current" image after group select)
  const [, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  // Multi-image state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);

  // Spreadsheet state
  const [spreadsheetRows, setSpreadsheetRows] = useState<string[][]>([]);
  const [spreadsheetProducts, setSpreadsheetProducts] = useState<SpreadsheetProduct[]>([]);
  const [selectedSP, setSelectedSP] = useState<SpreadsheetProduct | null>(null);

  // Chat state
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
    setUploadedImages([]); setProductGroups([]); setSelectedGroup(null);
    setSpreadsheetRows([]); setSpreadsheetProducts([]);
    setSelectedSP(null); setProduct(null);
    setMessages([]); setUserInput('');
    setResult(null); setError('');
    setUploadKey(k => k + 1);
  }

  function closeChatPanel() {
    setSelectedSP(null); setSelectedGroup(null); setProduct(null);
    setMessages([]); setResult(null); setError('');
  }

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError('');
    setImageBase64(''); setImagePreview('');
    setUploadedImages([]); setProductGroups([]); setSelectedGroup(null);
    setSpreadsheetRows([]);
    revokeThumbnails(spreadsheetProducts);
    setSpreadsheetProducts([]);

    const allImages = files.every(f => f.type.startsWith('image/'));
    const firstFile = files[0];

    if (allImages) {
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) { setError('每张图片不能超过 10MB'); return; }
      }
      setFileType('image');
      const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
      const images: UploadedImage[] = await Promise.all(
        dataUrls.map(async u => ({ base64: await compressImageBase64(u.split(',')[1]), preview: u }))
      );
      setUploadedImages(images);
      // Pre-set single image state from first image so chatting/done phases work
      setImageBase64(images[0].base64);
      setImagePreview(images[0].preview);
    } else if (firstFile.type.startsWith('video/')) {
      setFileType('video'); setLoading(true);
      try {
        const { base64, preview } = await extractVideoFrame(firstFile);
        setImageBase64(base64); setImagePreview(preview);
        setUploadedImages([{ base64, preview }]);
      } catch { setError('视频帧提取失败'); }
      finally { setLoading(false); }
    } else if (isSpreadsheetFile(firstFile)) {
      if (firstFile.size > 20 * 1024 * 1024) { setError('表格文件不能超过 20MB'); return; }
      setFileType('spreadsheet'); setLoading(true);
      try {
        const [{ rows }, images] = await Promise.all([
          parseSpreadsheet(firstFile),
          extractExcelImages(firstFile),
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
    if (!uploadedImages.length) return;
    setLoading(true); setError('');
    try {
      const identified: Product[] = [];
      for (const img of uploadedImages) {
        const result = await callIdentifyApi({ image: img.base64 });
        identified.push(result);
      }
      const groups = await callGroupApi(identified);
      setProductGroups(groups);

      if (groups.length <= 1) {
        // Single group — skip select, go straight to chat
        const g = groups[0] ?? { indices: [0], ...identified[0] };
        const prod = { name: g.name, category: g.category, brand: g.brand };
        setProduct(prod);
        const firstIdx = g.indices[0] ?? 0;
        setImageBase64(uploadedImages[firstIdx].base64);
        setImagePreview(uploadedImages[firstIdx].preview);
        await startChat([{
          role: 'user',
          content: `商品信息：名称=${prod.name}，类别=${prod.category}，品牌=${prod.brand}`,
        }]);
      } else {
        setPhase('select');
      }
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

  async function handleSelectGroup(group: ProductGroup) {
    if (loading) return;
    const prod = { name: group.name, category: group.category, brand: group.brand };
    setProduct(prod);
    setSelectedGroup(group);
    setMessages([]); setResult(null); setError('');
    const firstIdx = group.indices[0] ?? 0;
    setImageBase64(uploadedImages[firstIdx].base64);
    setImagePreview(uploadedImages[firstIdx].preview);
    setLoading(true);
    try {
      await startChat([{
        role: 'user',
        content: `商品信息：名称=${prod.name}，类别=${prod.category}，品牌=${prod.brand}`,
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

  async function handleSendWithAttachments(text: string, files: File[]) {
    setUserInput(''); setError(''); setLoading(true);
    try {
      const attachments: ChatAttachment[] = [];
      const contextParts: string[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (['xlsx', 'xls', 'csv'].includes(ext)) {
          const [{ rows }, images] = await Promise.all([parseSpreadsheet(file), extractExcelImages(file)]);
          attachments.push({ type: 'spreadsheet', preview: '', name: file.name, rows: rows.slice(0, 20), images });
          // 结构化表格内容：表头 + 前8行数据
          const headers = rows[0]?.join(' | ') ?? '';
          const dataLines = rows.slice(1, 9).map((r, i) => `第${i + 1}行: ${r.filter(Boolean).join(' | ')}`).join('\n');
          contextParts.push(`【补充表格 ${file.name}】\n表头: ${headers}\n${dataLines}`);
        } else if (['mp4', 'mov', 'webm'].includes(ext)) {
          const { preview: framePreview, base64: frameB64 } = await extractVideoFrame(file);
          attachments.push({ type: 'video', preview: framePreview, name: file.name });
          // 视频帧识别
          let desc = file.name;
          try { const r = await callIdentifyApi({ image: frameB64 }); desc = `${r.name}（${r.category}，品牌：${r.brand}）`; } catch {}
          contextParts.push(`【补充视频】视频帧中识别到：${desc}`);
        } else {
          const dataUrl = await readFileAsDataUrl(file);
          const compressed = await compressImageBase64(dataUrl.split(',')[1]);
          attachments.push({ type: 'image', preview: dataUrl, name: file.name });
          let desc = file.name;
          try { const r = await callIdentifyApi({ image: compressed }); desc = `${r.name}（${r.category}，品牌：${r.brand}）`; } catch {}
          contextParts.push(`【补充图片】图片中识别到：${desc}`);
        }
      }

      // UI只显示用户输入的文字；API收到完整上下文（含图片描述/表格数据）
      const displayContent = text.trim();
      const productAnchor = product
        ? `[估价目标锁定：${product.name}（${product.category}），补充资料仅作参考，禁止切换估价目标]`
        : '';
      const apiContent = [text.trim(), ...contextParts, productAnchor].filter(Boolean).join('\n');

      const userMsg: ChatMessage = { role: 'user', content: displayContent, attachments };
      const newMessages: ChatMessage[] = [...messages, userMsg];
      setMessages(newMessages);

      // 最后一条消息用apiContent（含上下文），历史消息原样传
      const apiMessages = newMessages.map((m, idx) =>
        idx === newMessages.length - 1
          ? { role: m.role, content: apiContent }
          : { role: m.role, content: m.content }
      );
      const data = await callPricingApi(apiMessages);
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

  const hasFile = uploadedImages.length > 0 || spreadsheetProducts.length > 0;
  const showSidebar = !!imagePreview;
  const fromSpreadsheet = spreadsheetProducts.length > 0;
  const hasSelection = !!(selectedSP || selectedGroup);

  const chatPanelProps = {
    product, messages, loading, result, error, userInput, phase,
    thumbnail: selectedSP?.thumbnail || imagePreview || undefined,
    fromSpreadsheet,
    onSendAnswer: handleSendAnswer,
    onSendWithAttachments: handleSendWithAttachments,
    onInputChange: setUserInput,
    onClose: closeChatPanel,
    onReset: reset,
    onGoToSelect: () => { setPhase('select'); setSelectedSP(null); setSelectedGroup(null); setMessages([]); setResult(null); },
    onAcceptQuote: result ? () => setShowMethodModal(true) : undefined,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f0f2f7] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base shadow-md">📦</div>
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">
              Inventory Liquidity <span className="text-violet-400">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Recovery nav */}
            <button
              onClick={() => setAppView('orders')}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all ${appView === 'orders' ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}
            >
              📋 订单
            </button>
            <button
              onClick={() => setAppView('cart')}
              className={`relative flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all ${appView === 'cart' ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}
            >
              🛒 待回收
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
            {appView !== 'valuation' ? (
              <button
                onClick={() => setAppView('valuation')}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
              >
                ← 估价
              </button>
            ) : phase !== 'upload' && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
              >
                <span>↺</span> New
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Recovery Method Modal */}
      {showMethodModal && result && (
        <RecoveryMethodModal
          result={result}
          product={product}
          thumbnail={selectedSP?.thumbnail || imagePreview || undefined}
          onClose={() => setShowMethodModal(false)}
          onAddedToCart={() => { setShowMethodModal(false); }}
          onOrderCreated={() => { setShowMethodModal(false); setAppView('orders'); }}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">

        {/* ── App view: cart ── */}
        {appView === 'cart' && (
          <RecoveryCartPage
            onBack={() => setAppView('valuation')}
            onOrdersView={() => setAppView('orders')}
          />
        )}

        {/* ── App view: orders ── */}
        {appView === 'orders' && (
          <RecoveryOrderListPage onBack={() => setAppView('valuation')} />
        )}

        {/* ── App view: valuation ── */}
        {appView === 'valuation' && <>

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <div className="max-w-xl mx-auto" key={uploadKey}>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a]">Get Instant Valuation</h2>
              <p className="text-slate-500 mt-2 text-sm sm:text-base">
                Upload photos, a video, or spreadsheet — AI guides you to the best price.
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
                {/* Multi-image preview */}
                {uploadedImages.length > 1 ? (
                  <div className="p-4">
                    <div className={`grid gap-2 ${
                      uploadedImages.length === 2 ? 'grid-cols-2' :
                      uploadedImages.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
                    } max-h-72 overflow-hidden`}>
                      {uploadedImages.slice(0, 8).map((img, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                          <img src={img.preview} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-3">
                      已选 {uploadedImages.length} 张图片 · 点击更换
                    </p>
                  </div>
                ) : imagePreview ? (
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
                    <p className="text-base font-semibold text-slate-700">Drop your files here</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400">📷 Images (multi-select)</span>
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

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />

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
                  ) : uploadedImages.length > 1 ? (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> Identify &amp; Group ({uploadedImages.length} images)</>
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
          <div className={`${hasSelection ? 'flex gap-4 items-start max-w-3xl mx-auto' : 'max-w-5xl mx-auto'}`}>
            <div className={hasSelection ? 'w-48 flex-shrink-0' : 'w-full'}>
              {!hasSelection && (
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a]">选择要估价的产品</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {fromSpreadsheet
                      ? `共找到 ${spreadsheetProducts.length} 个产品，点击任意一个开始 AI 估价`
                      : `AI 识别出 ${productGroups.length} 组产品，点击任意一组开始 AI 估价`}
                  </p>
                </div>
              )}
              {hasSelection && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    {fromSpreadsheet ? `Products (${spreadsheetProducts.length})` : `Groups (${productGroups.length})`}
                  </p>
                </div>
              )}
              {error && !hasSelection && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* ── Spreadsheet product grid ── */}
              {fromSpreadsheet && !selectedSP && (
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

              {/* ── Spreadsheet product sidebar ── */}
              {fromSpreadsheet && selectedSP && (
                <div className="space-y-1.5 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                  {spreadsheetProducts.map((sp, i) => (
                    <button key={i} onClick={() => handleSelectProduct(sp)} disabled={loading}
                      className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                        selectedSP === sp ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200'
                      }`}>
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
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

              {/* ── Image group grid ── */}
              {!fromSpreadsheet && !selectedGroup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productGroups.map((g, i) => (
                    <button key={i} onClick={() => handleSelectGroup(g)} disabled={loading}
                      className="text-left bg-white rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-lg shadow-sm overflow-hidden transition-all group disabled:opacity-50">
                      <div className="w-full aspect-square bg-slate-100 overflow-hidden">
                        {g.indices.length === 1 ? (
                          <img
                            src={uploadedImages[g.indices[0]]?.preview}
                            alt={g.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full grid grid-cols-2 gap-0.5">
                            {g.indices.slice(0, 4).map(idx => (
                              <img
                                key={idx}
                                src={uploadedImages[idx]?.preview}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold text-slate-800 text-sm group-hover:text-violet-700 transition-colors truncate">{g.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 mb-3">
                          {g.category}{g.brand ? ` · ${g.brand}` : ''} · {g.indices.length} 张图片
                        </p>
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

              {/* ── Image group sidebar ── */}
              {!fromSpreadsheet && selectedGroup && (
                <div className="space-y-1.5 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                  {productGroups.map((g, i) => (
                    <button key={i} onClick={() => handleSelectGroup(g)} disabled={loading}
                      className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                        selectedGroup === g ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200'
                      }`}>
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                        {g.indices.length === 1 ? (
                          <img src={uploadedImages[g.indices[0]]?.preview} alt={g.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid grid-cols-2 gap-0.5">
                            {g.indices.slice(0, 4).map(idx => (
                              <img key={idx} src={uploadedImages[idx]?.preview} alt="" className="w-full h-full object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${selectedGroup === g ? 'text-violet-700' : 'text-slate-800'}`}>{g.name}</p>
                        <p className="text-[10px] text-slate-400">{g.indices.length} 张图片</p>
                      </div>
                      {selectedGroup === g && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasSelection && (
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
                    <img src={imagePreview} alt={product.name} className="w-full h-44 object-cover" />
                    {fileType === 'video' && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Video
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Product</p>
                      <p className="text-sm font-bold text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Brand</p>
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

        </>}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px]">📦</div>
            <span className="font-medium text-slate-500">Inventory Liquidity AI</span>
            <span className="text-slate-300">·</span>
            <span>v1.2.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Developer: Dreams-as-Steed</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-5.972 2.932-7.715 1.613-1.015 3.555-1.427 5.44-1.269-.692-3.633-4.283-6.493-8.983-6.493zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-3.144 2.586-3.144 6.833-.002 9.418 3.14 2.586 8.664 2.588 11.806.002.01-.008.017-.018.026-.025l1.56.922a.268.268 0 00.138.046c.131 0 .24-.108.24-.247 0-.06-.023-.12-.039-.177l-.322-1.218a.495.495 0 01.178-.553C24.476 17.1 25.5 15.33 25.5 13.419c0-3.394-3.186-6.133-8.562-6.561z" />
              </svg>
              WeChat: <span className="font-medium text-slate-600 select-all">rsrzrcjaky</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>© 2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

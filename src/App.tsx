import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import type { Phase, FileType, Product, SpreadsheetProduct, ChatMessage, ChatAttachment, PricingResult, UploadedImage, ProductGroup } from './types';
import { extractVideoFrame, parseSpreadsheet, extractExcelImages, extractProducts, compressImageBase64 } from './lib/media';
import { callPricingApi } from './services/pricingApi';
import { callIdentifyApi } from './services/identifyApi';
import { callGroupApi } from './services/groupApi';
import { ChatPanel } from './ui/blocks/ChatPanel';
import { RecoveryMethodModal } from './modules/recovery/RecoveryMethodModal';
import { RecoveryCartPage } from './modules/recovery/RecoveryCartPage';
import { RecoveryOrderListPage } from './modules/recovery/RecoveryOrderListPage';
import { AdminLayout } from './modules/admin/AdminLayout';
import { CustomersPage } from './modules/admin/CustomersPage';
import { InquiryListPage } from './modules/admin/InquiryListPage';
import { InquiryDetailRoute } from './modules/admin/InquiryDetailPage';
import { useRecoveryStore } from './stores/recoveryStore';
import { useAuthStore } from './stores/authStore';


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



const _vs = (() => {
  try {
    const r = localStorage.getItem('valuation-session');
    if (!r) return null;
    const d = JSON.parse(r);
    if (!d || typeof d !== 'object' || !['select', 'chatting'].includes(d.phase)) return null;
    if (typeof d.imageCount === 'number') {
      d.uploadedImages = Array.from({ length: d.imageCount }, (_, i) =>
        localStorage.getItem(`valuation-img-${i}`) ?? ''
      ).filter(Boolean);
    }
    if (!Array.isArray(d.uploadedImages)) d.uploadedImages = [];
    return d;
  } catch { return null; }
})();

function saveSession(data: object) {
  try { localStorage.setItem('valuation-session', JSON.stringify(data)); } catch { /* quota */ }
}
function clearSession() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('valuation-img-')) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('valuation-session');
  localStorage.removeItem('valuation-groups');
}

export default function App() {
  useAuthStore(); // keep subscription alive
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = pathname.startsWith('/admin');
  const isCart = pathname === '/cart';
  const isOrders = pathname === '/orders';
  const isValuation = !isAdmin && !isCart && !isOrders;

  const [showMethodModal, setShowMethodModal] = useState(false);
  const cartCount = useRecoveryStore(s => s.cart.length);


  const [phase, setPhase] = useState<Phase>(_vs?.phase ?? 'upload');
  const [fileType, setFileType] = useState<FileType>(_vs?.fileType ?? 'image');

  // Single-image / video state (also used as "current" image after group select)
  const [imageBase64, setImageBase64] = useState<string>(_vs?.imageBase64 ?? '');
  const [imagePreview, setImagePreview] = useState<string>(
    _vs?.imageBase64 ? `data:image/jpeg;base64,${_vs.imageBase64}` : ''
  );

  // Multi-image state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>(
    () => (_vs?.uploadedImages ?? []).map((url: string) => ({ base64: url.split(',')[1] ?? url, preview: url, thumbnail: url }))
  );
  const [productGroups, setProductGroups] = useState<ProductGroup[]>(_vs?.productGroups ?? []);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(() => {
    const groups = _vs?.productGroups ?? [];
    const i = _vs?.selGroupIdx ?? -1;
    return i >= 0 ? groups[i] ?? null : null;
  });

  // Spreadsheet state
  const [spreadsheetRows, setSpreadsheetRows] = useState<string[][]>(_vs?.spreadsheetRows ?? []);
  const [spreadsheetProducts, setSpreadsheetProducts] = useState<SpreadsheetProduct[]>(_vs?.spreadsheetProducts ?? []);
  const [selectedSP, setSelectedSP] = useState<SpreadsheetProduct | null>(
    () => { const p = _vs?.spreadsheetProducts; const i = _vs?.selSPIdx ?? -1; return p && i >= 0 ? p[i] ?? null : null; }
  );

  // Chat state
  const [product, setProduct] = useState<Product | null>(_vs?.product ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(_vs?.messages ?? []);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<PricingResult | null>(_vs?.result ?? null);
  const [groupResults, setGroupResults] = useState<Record<number, PricingResult>>(_vs?.groupResults ?? {});
  const [spResults, setSpResults] = useState<Record<number, PricingResult>>(_vs?.spResults ?? {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const [addingProduct, setAddingProduct] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addProductInputRef = useRef<HTMLInputElement>(null);

  // ── Session persistence (survives same-tab refresh) ───────────────────────
  useEffect(() => {
    if (phase === 'upload') { clearSession(); return; }
    // Images are stored in separate keys (valuation-img-{i}) to avoid quota issues
    saveSession({
      phase, fileType, imageBase64,
      imageCount: uploadedImages.length,
      productGroups,
      spreadsheetProducts: spreadsheetProducts.map(sp => ({ ...sp, thumbnail: sp.thumbnail?.startsWith('blob:') ? undefined : sp.thumbnail })),
      spreadsheetRows,
      product, result, groupResults, spResults,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      selGroupIdx: selectedGroup ? productGroups.indexOf(selectedGroup) : -1,
      selSPIdx: selectedSP ? spreadsheetProducts.indexOf(selectedSP) : -1,
    });
  }, [phase, fileType, imageBase64, uploadedImages, productGroups, spreadsheetProducts, spreadsheetRows, product, result, messages, selectedGroup, selectedSP]);

  // Record completed valuation result for each product in the sidebar
  useEffect(() => {
    if (!result) return;
    if (selectedGroup) {
      const i = productGroups.indexOf(selectedGroup);
      if (i >= 0) setGroupResults(prev => ({ ...prev, [i]: result }));
    } else if (selectedSP) {
      const i = spreadsheetProducts.indexOf(selectedSP);
      if (i >= 0) setSpResults(prev => ({ ...prev, [i]: result }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Save each thumbnail to localStorage (survives refresh reliably)
  useEffect(() => {
    if (phase === 'upload') return;
    uploadedImages.forEach((img, i) => {
      const url = img.thumbnail || (img.base64 ? `data:image/jpeg;base64,${img.base64}` : '');
      if (!url) return;
      try {
        localStorage.setItem(`valuation-img-${i}`, url);
      } catch { /* quota */ }
    });
  }, [uploadedImages, phase]);

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
    setResult(null); setGroupResults({}); setSpResults({}); setError('');
    setUploadKey(k => k + 1);
    clearSession();
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
        dataUrls.map(async u => {
          const b64 = await compressImageBase64(u.split(',')[1]);
          const thumb = await compressImageBase64(b64, 160, 0.6);
          return { base64: b64, preview: u, thumbnail: `data:image/jpeg;base64,${thumb}` };
        })
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
        const productsWithThumbs = await Promise.all(products.map(async (p, i) => {
          if (!images[i]) return p;
          try {
            const b64 = images[i].split(',')[1];
            const small = await compressImageBase64(b64, 160, 0.6);
            return { ...p, thumbnail: `data:image/jpeg;base64,${small}` };
          } catch { return { ...p, thumbnail: images[i] }; }
        }));
        setSpreadsheetProducts(productsWithThumbs);
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
    } else {
      setMessages([...initMessages, { role: 'assistant', content: data.reply }]);
    }
    if (changePhase) setPhase('chatting');
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
      const groupsWithThumbs = groups.map(g => ({
        ...g,
        thumbnail: uploadedImages[g.indices[0] ?? 0]?.thumbnail || '',
      }));
      setProductGroups(groupsWithThumbs);

      if (groupsWithThumbs.length <= 1) {
        // Single group — skip select, go straight to chat
        const g = groupsWithThumbs[0] ?? { indices: [0], ...identified[0] };
        const prod = { name: g.name, category: g.category, brand: g.brand };
        setProduct(prod);
        setSelectedGroup(g);
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

  async function handleAddProduct(files: File[]) {
    if (!files.length || addingProduct) return;
    setAddingProduct(true);
    setError('');
    try {
      // ── Spreadsheet files ──────────────────────────────────────────────────
      for (const file of files.filter(isSpreadsheetFile)) {
        if (file.size > 20 * 1024 * 1024) { setError('表格文件不能超过 20MB'); continue; }
        const [{ rows }, imgs] = await Promise.all([parseSpreadsheet(file), extractExcelImages(file)]);
        const products = extractProducts(rows);
        const productsWithThumbs = await Promise.all(products.map(async (p, i) => {
          if (!imgs[i]) return p;
          try {
            const b64 = imgs[i].split(',')[1];
            const small = await compressImageBase64(b64, 160, 0.6);
            return { ...p, thumbnail: `data:image/jpeg;base64,${small}` };
          } catch { return { ...p, thumbnail: imgs[i] }; }
        }));
        setSpreadsheetProducts(prev => [...prev, ...productsWithThumbs]);
      }

      // ── Video files ────────────────────────────────────────────────────────
      for (const file of files.filter(f => f.type.startsWith('video/'))) {
        const { base64, preview } = await extractVideoFrame(file);
        const thumb = await compressImageBase64(base64, 160, 0.6);
        const thumbnail = `data:image/jpeg;base64,${thumb}`;
        const identified = await callIdentifyApi({ image: base64 });
        if (fromSpreadsheet) {
          setSpreadsheetProducts(prev => [...prev, {
            name: identified.name, category: identified.category, brand: identified.brand,
            rowText: `名称=${identified.name}，类别=${identified.category}，品牌=${identified.brand}`,
            details: { '名称': identified.name, '类别': identified.category, '品牌': identified.brand },
            thumbnail,
          }]);
        } else {
          const newImg: UploadedImage = { base64, preview, thumbnail };
          const offset = uploadedImages.length;
          setUploadedImages(prev => [...prev, newImg]);
          setProductGroups(prev => [...prev, { name: identified.name, category: identified.category, brand: identified.brand, indices: [offset], thumbnail }]);
        }
      }

      // ── Image files ────────────────────────────────────────────────────────
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length) {
        for (const f of imageFiles) {
          if (f.size > 10 * 1024 * 1024) { setError('每张图片不能超过 10MB'); return; }
        }
        const dataUrls = await Promise.all(imageFiles.map(readFileAsDataUrl));
        const newImages: UploadedImage[] = await Promise.all(
          dataUrls.map(async u => {
            const b64 = await compressImageBase64(u.split(',')[1]);
            const thumb = await compressImageBase64(b64, 160, 0.6);
            return { base64: b64, preview: u, thumbnail: `data:image/jpeg;base64,${thumb}` };
          })
        );
        const identified: Product[] = [];
        for (const img of newImages) {
          identified.push(await callIdentifyApi({ image: img.base64 }));
        }
        if (fromSpreadsheet) {
          setSpreadsheetProducts(prev => [...prev, ...identified.map((p, i) => ({
            name: p.name, category: p.category, brand: p.brand,
            rowText: `名称=${p.name}，类别=${p.category}，品牌=${p.brand}`,
            details: { '名称': p.name, '类别': p.category, '品牌': p.brand },
            thumbnail: newImages[i]?.thumbnail,
          }))]);
        } else {
          const offset = uploadedImages.length;
          let newGroups: ProductGroup[];
          if (identified.length === 1) {
            newGroups = [{ name: identified[0].name, category: identified[0].category, brand: identified[0].brand, indices: [offset], thumbnail: newImages[0]?.thumbnail || '' }];
          } else {
            const grouped = await callGroupApi(identified);
            newGroups = grouped.map(g => ({ ...g, indices: g.indices.map(i => i + offset), thumbnail: newImages[g.indices[0] ?? 0]?.thumbnail || '' }));
          }
          setUploadedImages(prev => [...prev, ...newImages]);
          setProductGroups(prev => [...prev, ...newGroups]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败，请重试');
    } finally {
      setAddingProduct(false);
    }
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
        // stay on current phase — ChatPanel handles result display inline
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
        // stay on current phase — ChatPanel handles result display inline
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试');
    } finally { setLoading(false); }
  }

  const hasFile = uploadedImages.length > 0 || spreadsheetProducts.length > 0;
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
          <button
            onClick={() => { reset(); navigate('/'); }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base shadow-md">📦</div>
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">
              Inventory Liquidity <span className="text-violet-400">AI</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {/* Add product shortcut — visible during select/chatting */}
            {isValuation && (phase === 'select' || phase === 'chatting') && (
              <button
                onClick={() => addProductInputRef.current?.click()}
                disabled={addingProduct || loading}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingProduct
                  ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> 识别中</>
                  : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> 添加产品</>
                }
              </button>
            )}
            {/* Nav links */}
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}>
              🏢 后台
            </NavLink>
            <NavLink to="/orders" className={({ isActive }) => `flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}>
              📋 订单
            </NavLink>
            <NavLink to="/cart" className={({ isActive }) => `relative flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}>
              🛒 待回收
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </NavLink>
            {!isValuation ? (
              <button
                onClick={() => navigate('/')}
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
          onOrderCreated={() => { setShowMethodModal(false); navigate('/orders'); }}
        />
      )}

      <Routes>
        <Route path="/cart" element={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">
            <RecoveryCartPage onBack={() => navigate('/')} onOrdersView={() => navigate('/orders')} />
          </main>
        } />
        <Route path="/orders" element={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">
            <RecoveryOrderListPage onBack={() => navigate('/')} />
          </main>
        } />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="customers" replace />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="inquiries" element={<InquiryListPage />} />
          <Route path="inquiries/:id" element={<InquiryDetailRoute />} />
        </Route>
        <Route path="/" element={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">
          <>

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

        {/* ── Phase: select / chatting — unified sidebar+chat layout ── */}
        {(phase === 'select' || phase === 'chatting') && (
          <div className="flex gap-5 items-start w-full">

            {/* Left: product list card */}
            <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[640px]">
              {/* Card header */}
              <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex-shrink-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {fromSpreadsheet
                    ? `Products · ${spreadsheetProducts.length}`
                    : `Groups · ${productGroups.length}`}
                </p>
              </div>

              {/* Scrollable product list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {fromSpreadsheet
                  ? spreadsheetProducts.map((sp, i) => (
                      <button key={i} onClick={() => handleSelectProduct(sp)} disabled={loading || addingProduct}
                        className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          selectedSP === sp ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                        }`}>
                        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                          {sp.thumbnail
                            ? <img src={sp.thumbnail} alt={sp.name} className="w-full h-full object-cover" />
                            : <span className="text-lg opacity-30">📦</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selectedSP === sp ? 'text-violet-700' : 'text-slate-800'}`}>{sp.name}</p>
                          {spResults[i]
                            ? <p className="text-xs font-semibold text-emerald-600 truncate">{spResults[i].estimated_price}</p>
                            : <p className="text-xs text-slate-400 truncate">{sp.category}</p>}
                        </div>
                        {selectedSP === sp && <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 animate-pulse" />}
                      </button>
                    ))
                  : productGroups.map((g, i) => (
                      <button key={i} onClick={() => handleSelectGroup(g)} disabled={loading || addingProduct}
                        className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                          selectedGroup === g ? 'border-violet-300 bg-violet-50 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                        }`}>
                        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                          {g.indices.length === 1 || uploadedImages.length === 0
                            ? <img src={g.thumbnail || uploadedImages[g.indices[0]]?.thumbnail || uploadedImages[g.indices[0]]?.preview} alt={g.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full grid grid-cols-2 gap-0.5">
                                {g.indices.slice(0, 4).map(idx => (
                                  <img key={idx} src={uploadedImages[idx]?.thumbnail || uploadedImages[idx]?.preview} alt="" className="w-full h-full object-cover" />
                                ))}
                              </div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selectedGroup === g ? 'text-violet-700' : 'text-slate-800'}`}>{g.name}</p>
                          {groupResults[i]
                            ? <p className="text-xs font-semibold text-emerald-600">{groupResults[i].estimated_price}</p>
                            : <p className="text-xs text-slate-400">{g.indices.length} 图</p>}
                        </div>
                        {selectedGroup === g && <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 animate-pulse" />}
                      </button>
                    ))
                }
              </div>

              {/* Add product upload zone — anchored at bottom, always visible */}
              <div className="p-2 pt-0 flex-shrink-0">
                <button
                  onClick={() => addProductInputRef.current?.click()}
                  disabled={addingProduct || loading}
                  className="w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 bg-slate-50 hover:bg-violet-50/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed p-3"
                >
                  {addingProduct ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <svg className="animate-spin h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                      <span className="text-xs text-slate-500">AI 识别中…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-600">添加新产品</p>
                      <p className="text-[10px] text-slate-400">📷 图片（多选）· max 10MB</p>
                    </div>
                  )}
                </button>
                <input
                  ref={addProductInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    handleAddProduct(files);
                  }}
                />
              </div>
            </div>

            {/* Right: chat panel or select placeholder */}
            <div className="flex-1 min-w-0">
              {(phase === 'chatting' || hasSelection) ? (
                <ChatPanel {...chatPanelProps} compact />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 h-[640px] flex flex-col items-center justify-center text-center px-6 gap-3">
                  {error && <p className="text-sm text-red-500">⚠️ {error}</p>}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">👈</div>
                  <p className="text-sm font-semibold text-slate-700">
                    {fromSpreadsheet ? '从左侧选择一个产品开始 AI 估价' : '从左侧选择一组产品开始 AI 估价'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fromSpreadsheet
                      ? `共 ${spreadsheetProducts.length} 个产品`
                      : `共 ${productGroups.length} 组，AI 已识别分类`}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

                  </>
          </main>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Footer — hidden on admin pages */}
      {!isAdmin && <footer className="border-t border-slate-200 bg-white">
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
      </footer>}
    </div>
  );
}

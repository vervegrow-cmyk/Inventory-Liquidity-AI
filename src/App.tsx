import { useState, useRef, useEffect } from 'react';

type Phase = 'upload' | 'chatting' | 'done';

interface Product {
  name: string;
  category: string;
  brand: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PricingResult {
  estimated_price: string;
  resale_price: string;
  quick_sale_price: string;
  confidence: string;
  reason: string;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高 ✅',
  medium: '中 ⚠️',
  low: '低 ❓',
};

export default function App() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (phase === 'chatting' && !loading) {
      inputRef.current?.focus();
    }
  }, [phase, loading, messages]);

  function reset() {
    setPhase('upload');
    setImageBase64('');
    setImagePreview('');
    setProduct(null);
    setMessages([]);
    setUserInput('');
    setResult(null);
    setError('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('图片不能超过 10MB');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // strip "data:image/...;base64," prefix
      setImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleStartValuation() {
    if (!imageBase64) return;
    setLoading(true);
    setError('');

    try {
      // Step 1: identify
      const idRes = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });
      if (!idRes.ok) throw new Error(`识别失败 (${idRes.status})`);
      const identified: Product = await idRes.json();
      setProduct(identified);

      // Step 2: first chat turn with product info
      const firstUserMsg: Message = {
        role: 'user',
        content: `商品信息：名称=${identified.name}，类别=${identified.category}，品牌=${identified.brand}`,
      };
      const nextMessages = [firstUserMsg];

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!chatRes.ok) throw new Error(`对话失败 (${chatRes.status})`);
      const chatData = await chatRes.json();

      if (chatData.done) {
        setResult(chatData);
        setMessages([firstUserMsg, { role: 'assistant', content: chatData.reason }]);
        setPhase('done');
      } else {
        setMessages([firstUserMsg, { role: 'assistant', content: chatData.question }]);
        setPhase('chatting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendAnswer() {
    if (!userInput.trim() || loading) return;
    const answer = userInput.trim();
    setUserInput('');
    setError('');

    const newMessages: Message[] = [...messages, { role: 'user', content: answer }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok) throw new Error(`对话失败 (${res.status})`);
      const data = await res.json();

      if (data.done) {
        setResult(data);
        setMessages([...newMessages, { role: 'assistant', content: data.reason }]);
        setPhase('done');
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.question }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#0f172a] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base shadow-md">
              📦
            </div>
            <div>
              <span className="text-white font-bold text-base sm:text-lg tracking-tight">
                Inventory Liquidity <span className="text-violet-400">AI</span>
              </span>
            </div>
          </div>
          {phase !== 'upload' && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
            >
              <span>↺</span> New Appraisal
            </button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <div className="max-w-xl mx-auto">
            {/* Hero text */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] leading-tight">
                Get Instant Valuation
              </h2>
              <p className="text-slate-500 mt-2 text-sm sm:text-base">
                Upload a product photo — AI identifies it and guides you to the best price.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer transition-all duration-200 ${
                  imagePreview
                    ? 'bg-slate-50'
                    : 'bg-gradient-to-b from-slate-50 to-white hover:from-violet-50/60 hover:to-white'
                }`}
              >
                {imagePreview ? (
                  <div className="p-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="mx-auto max-h-72 rounded-xl object-contain"
                    />
                    <p className="text-center text-xs text-slate-400 mt-3">Click to change photo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4 shadow-inner">
                      <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-base font-semibold text-slate-700">Drop your product photo here</p>
                    <p className="text-sm text-slate-400 mt-1">or click to browse · JPG / PNG · max 10 MB</p>
                  </div>
                )}
                {/* dashed border overlay */}
                <div className="absolute inset-3 rounded-xl border-2 border-dashed border-slate-200 pointer-events-none" />
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              <div className="p-5 border-t border-slate-100 space-y-3">
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                    <span>⚠️</span> {error}
                  </div>
                )}
                <button
                  onClick={handleStartValuation}
                  disabled={!imageBase64 || loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Analyzing product...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Start Valuation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: chatting ── */}
        {phase === 'chatting' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Left sidebar: product card (desktop) */}
            {product && imagePreview && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-20">
                  <img src={imagePreview} alt={product.name} className="w-full aspect-square object-cover" />
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Product</p>
                      <p className="text-sm font-bold text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{product.category}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Brand</p>
                      <p className="text-sm font-medium text-slate-700">{product.brand}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        <p className="text-xs text-slate-500">AI Appraisal in progress</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat panel */}
            <div className="lg:col-span-2 w-full">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[580px] sm:h-[640px]">
                {/* Mobile top bar */}
                {product && (
                  <div className="flex lg:hidden items-center gap-3 px-4 py-3 border-b border-slate-100 bg-[#0f172a] rounded-t-2xl">
                    {imagePreview && (
                      <img src={imagePreview} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                      <p className="text-xs text-slate-400">{product.brand} · {product.category}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                      <span className="text-xs text-slate-400">Analyzing</span>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  {messages.filter(m => m.role === 'assistant' || (m.role === 'user' && !m.content.startsWith('商品信息：'))).map((msg, i) => (
                    <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs flex-shrink-0 mb-0.5">
                          🤖
                        </div>
                      )}
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#0f172a] text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-end gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs flex-shrink-0">
                        🤖
                      </div>
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input bar */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl space-y-2">
                  {error && <p className="text-xs text-red-500 px-1">⚠️ {error}</p>}
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendAnswer()}
                      placeholder="Type your answer..."
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendAnswer}
                      disabled={!userInput.trim() || loading}
                      className="px-4 py-2.5 bg-[#0f172a] hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      <span className="hidden sm:inline">Send</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Left: image */}
            {imagePreview && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-20">
                  <img src={imagePreview} alt={product?.name} className="w-full aspect-square object-cover" />
                  <div className="p-4">
                    <p className="text-sm font-bold text-slate-800">{product?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{product?.brand} · {product?.category}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Right: results */}
            <div className="lg:col-span-2 w-full space-y-4">
              {/* Header banner */}
              <div className="bg-[#0f172a] rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg">
                  ✅
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Appraisal Complete</p>
                  {product && <p className="text-slate-400 text-sm mt-0.5">{product.name}</p>}
                </div>
              </div>

              {/* Price grid */}
              <div className="grid grid-cols-2 gap-3">
                <PriceCard label="Purchase Price" value={result.estimated_price} accent="violet" />
                <PriceCard label="Resale Price" value={result.resale_price} accent="indigo" />
                <PriceCard label="Quick Sale" value={result.quick_sale_price} accent="slate" />
                <PriceCard label="Confidence" value={CONFIDENCE_LABEL[result.confidence] ?? result.confidence} accent="slate" />
              </div>

              {/* Reason */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">AI Analysis</p>
                <p className="text-sm text-slate-700 leading-relaxed">{result.reason}</p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={reset}
                  className="py-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-sm font-semibold transition-all"
                >
                  ↺ New Appraisal
                </button>
                <button
                  onClick={() => {
                    const text = `Product: ${product?.name}\nPurchase Price: ${result.estimated_price}\nResale Price: ${result.resale_price}\nQuick Sale: ${result.quick_sale_price}\nConfidence: ${result.confidence}`;
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

function PriceCard({ label, value, accent }: {
  label: string;
  value: string;
  accent: 'violet' | 'indigo' | 'slate';
}) {
  const styles = {
    violet: 'bg-gradient-to-br from-violet-600 to-violet-700 text-white',
    indigo: 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white',
    slate:  'bg-white border border-slate-200 text-slate-800',
  };
  const labelColor = accent === 'slate' ? 'text-slate-400' : 'text-white/70';
  const valueColor = accent === 'slate' ? 'text-slate-900' : 'text-white';

  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-sm ${styles[accent]}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${labelColor}`}>{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

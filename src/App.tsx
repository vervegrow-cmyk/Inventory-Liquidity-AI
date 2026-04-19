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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl">📦</span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">AI库存估价</h1>
                <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">专业商品估价工具</p>
              </div>
            </div>
            {(phase !== 'upload') && (
              <button
                onClick={reset}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                ↺ 重新开始
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8 space-y-4 sm:space-y-6">
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300"
            >
              {imagePreview ? (
                <div className="space-y-2">
                  <img src={imagePreview} alt="预览" className="mx-auto max-h-64 sm:max-h-96 rounded-lg object-contain shadow-md" />
                  <p className="text-xs sm:text-sm text-slate-500">点击更换图片</p>
                </div>
              ) : (
                <>
                  <div className="text-5xl sm:text-6xl mb-3 animate-bounce">📷</div>
                  <p className="text-base sm:text-lg font-medium text-slate-700">上传商品图片</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2">拖放或点击上传 JPG / PNG（≤10MB）</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {error && (
              <div className="p-3 sm:p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">❌ {error}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleStartValuation}
                disabled={!imageBase64 || loading}
                className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base sm:text-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>正在识别商品...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>开始估价</span>
                  </>
                )}
              </button>
            </div>
            </div>
          </div>
        )}

        {/* ── Phase: chatting ── */}
        {phase === 'chatting' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Product Info (hidden on mobile, shown on lg) */}
            {product && imagePreview && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden sticky top-24">
                  <div className="p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">商品信息</p>
                    <img src={imagePreview} alt={product.name} className="w-full rounded-lg object-cover mb-4 aspect-square shadow-md" />
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{product.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{product.category}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-500">品牌</p>
                        <p className="text-sm font-medium text-slate-700 mt-1">{product.brand}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Area */}
            <div className={`${product && imagePreview ? 'lg:col-span-2' : 'max-w-2xl mx-auto'} w-full`}>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[600px] sm:h-[700px]">
                {/* Product info bar (mobile only) */}
                {product && (
                  <div className="flex lg:hidden items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
                    {imagePreview && (
                      <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{product.brand} · {product.category}</p>
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs sm:max-w-sm px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none shadow-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm">
                        <span className="flex gap-1.5">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-6 space-y-3">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm text-red-700">❌ {error}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendAnswer()}
                      placeholder="输入你的回答..."
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition disabled:opacity-50 disabled:bg-slate-100"
                    />
                    <button
                      onClick={handleSendAnswer}
                      disabled={!userInput.trim() || loading}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm sm:text-base font-medium transition-colors shadow-md hover:shadow-lg"
                    >
                      <span className="hidden sm:inline">发送</span>
                      <span className="sm:hidden">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Product Image */}
            {imagePreview && (
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden sticky top-24">
                  <img src={imagePreview} alt={product?.name} className="w-full aspect-square object-cover" />
                  <div className="p-4 border-t border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">{product?.name}</p>
                    <p className="text-xs text-slate-500 mt-2">{product?.category}</p>
                    <p className="text-xs text-slate-500">{product?.brand}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Right: Results */}
            <div className={`${imagePreview ? 'lg:col-span-2' : 'max-w-2xl mx-auto'} w-full`}>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
                {/* Success Header */}
                <div className="text-center mb-8 pb-6 border-b border-slate-100">
                  <div className="text-5xl sm:text-6xl mb-3 animate-bounce">✅</div>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">估价完成</p>
                  {product && (
                    <p className="text-sm text-slate-500 mt-2">{product.name}</p>
                  )}
                </div>

                {/* Price Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                  <PriceCard 
                    emoji="💰" 
                    label="收货价" 
                    value={result.estimated_price}
                    highlight={true}
                  />
                  <PriceCard 
                    emoji="📈" 
                    label="转售价" 
                    value={result.resale_price}
                  />
                  <PriceCard 
                    emoji="⚡" 
                    label="快速出货价" 
                    value={result.quick_sale_price}
                  />
                  <PriceCard 
                    emoji="📊" 
                    label="置信度" 
                    value={CONFIDENCE_LABEL[result.confidence] ?? result.confidence}
                    isConfidence={true}
                  />
                </div>

                {/* Reason */}
                <div className="p-4 sm:p-6 rounded-xl bg-blue-50 border border-blue-200 mb-6">
                  <p className="text-sm font-semibold text-blue-900 mb-2">🧠 估价原因</p>
                  <p className="text-sm sm:text-base text-blue-800 leading-relaxed">{result.reason}</p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={reset}
                    className="py-3 sm:py-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-sm sm:text-base font-semibold transition-all duration-300"
                  >
                    ↺ 重新估价
                  </button>
                  <button
                    onClick={() => {
                      const text = `商品：${product?.name}\n收货价：${result.estimated_price}\n转售价：${result.resale_price}\n快速出货价：${result.quick_sale_price}\n置信度：${result.confidence}`;
                      navigator.clipboard.writeText(text);
                      alert('已复制到剪贴板');
                    }}
                    className="py-3 sm:py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm sm:text-base font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    📋 复制结果
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
function PriceCard({ 
  emoji, 
  label, 
  value, 
  highlight = false,
  isConfidence = false
}: {
  emoji: string; 
  label: string; 
  value: string; 
  highlight?: boolean;
  isConfidence?: boolean;
}) {
  return (
    <div className={`p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 ${
      highlight 
        ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100' 
        : 'border-slate-200 bg-slate-50 hover:border-blue-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-sm sm:text-base font-semibold ${highlight ? 'text-blue-900' : 'text-slate-700'}`}>
            {emoji} {label}
          </p>
        </div>
      </div>
      <p className={`text-lg sm:text-2xl font-bold mt-2 ${
        highlight 
          ? 'text-blue-600' 
          : isConfidence 
          ? 'text-slate-700'
          : 'text-slate-800'
      }`}>
        {value}
      </p>
    </div>
  );
}

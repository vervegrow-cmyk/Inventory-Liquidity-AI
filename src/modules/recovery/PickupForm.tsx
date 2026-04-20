import { useState } from 'react';
import type { PickupInfo } from '../../types/recovery';

interface Props {
  onSubmit: (info: PickupInfo) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function PickupForm({ onSubmit, onCancel, submitLabel = '确认' }: Props) {
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [notes, setNotes] = useState('');

  const canSubmit = address.trim() && contactName.trim() && contactPhone.trim() && timeSlot.trim();

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      address: address.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      timeSlot: timeSlot.trim(),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">上门自提信息</p>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          上门地址 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="填写详细上门地址（楼栋门牌等）"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            联系人 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder="姓名"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            联系电话 <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
            placeholder="手机号"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          预约上门时间 <span className="text-red-400">*</span>
        </label>
        <input
          type="datetime-local"
          value={timeSlot}
          onChange={e => setTimeSlot(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">备注（可选）</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="如：门口停车、电梯位置等"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      <div className={`grid gap-2 pt-1 ${onCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {onCancel && (
          <button
            onClick={onCancel}
            className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
          >
            ← 返回
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

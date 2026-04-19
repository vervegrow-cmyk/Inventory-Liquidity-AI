import { useRef } from 'react';
import { useNotesStore } from '../../stores/notesStore';

export default function SearchBar() {
  const { searchQuery, searchResults, isSearching, setSearchQuery, clearSearch, setActiveNote } = useNotesStore();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-1 max-w-md">
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
        <span className="text-slate-400 text-sm">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索笔记..."
          className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
        />
        {searchQuery && (
          <button onClick={clearSearch} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        )}
      </div>

      {searchQuery && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-sm text-slate-400 text-center">搜索中...</div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-sm text-slate-400 text-center">未找到相关笔记</div>
          ) : (
            searchResults.map(note => (
              <div
                key={note.id}
                onClick={() => { setActiveNote(note.id); clearSearch(); }}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
              >
                <div className="text-sm font-medium text-slate-800">{note.title || '无标题'}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{note.contentText.slice(0, 80)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { useNotesStore } from './stores/notesStore';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import SearchBar from './components/Search';

export default function App() {
  const { loadAll, createNote, activeFolderId } = useNotesStore();

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 bg-white">
          <SearchBar />
          <button
            onClick={() => createNote(activeFolderId)}
            className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> 新建笔记
          </button>
        </header>

        <main className="flex-1 overflow-hidden">
          <Editor />
        </main>
      </div>
    </div>
  );
}

import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useNotesStore } from '../../stores/notesStore';
import Toolbar from './Toolbar';

export default function Editor() {
  const { getActiveNote, updateNote } = useNotesStore();
  const note = getActiveNote();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始写作...' }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const id = noteIdRef.current;
      if (!id) return;
      const content = JSON.stringify(editor.getJSON());
      const contentText = editor.getText();
      const wordCount = contentText.replace(/\s+/g, '').length;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateNote(id, { content, contentText, wordCount });
      }, 600);
    },
  });

  useEffect(() => {
    noteIdRef.current = note?.id ?? null;
  });

  useEffect(() => {
    if (!editor || !note) return;
    let parsed: object | null = null;
    if (note.content) {
      try { parsed = JSON.parse(note.content); } catch { parsed = null; }
    }
    editor.commands.setContent(parsed ?? '');
  }, [note?.id, editor]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const id = noteIdRef.current;
    if (!id) return;
    updateNote(id, { title: e.target.value });
  }, [updateNote]);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-slate-400">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-lg font-medium">选择或创建一篇笔记</p>
          <p className="text-sm mt-1">从左侧文件夹中选择笔记，或点击 + 新建</p>
        </div>
      </div>
    );
  }

  const wordCount = note.wordCount || 0;
  const readingMin = Math.max(1, Math.ceil(wordCount / 300));

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="border-b border-slate-100 px-8 pt-6 pb-2">
        <input
          type="text"
          value={note.title}
          onChange={handleTitleChange}
          placeholder="笔记标题"
          className="w-full text-3xl font-bold text-slate-900 outline-none placeholder-slate-300 bg-transparent"
        />
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span>{new Date(note.updatedAt).toLocaleString('zh-CN')}</span>
          {note.tags.length > 0 && (
            <div className="flex gap-1">
              {note.tags.map(tag => (
                <span key={tag} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {editor && <Toolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto px-8 py-4">
        <EditorContent editor={editor} className="min-h-full" />
      </div>

      <div className="border-t border-slate-100 px-8 py-2 flex items-center gap-4 text-xs text-slate-400">
        <span>{wordCount} 字</span>
        <span>约 {readingMin} 分钟阅读</span>
        {note.isFavorite && <span className="text-yellow-500">★ 已收藏</span>}
      </div>
    </div>
  );
}

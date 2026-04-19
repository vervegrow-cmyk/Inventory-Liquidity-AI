import { useState } from 'react';
import { useNotesStore } from '../../stores/notesStore';
import type { Folder, Note } from '../../types';

export default function Sidebar() {
  const {
    folders, notes, activeFolderId, activeNoteId,
    createFolder, renameFolder, deleteFolder,
    createNote, deleteNote, setActiveNote, setActiveFolder, toggleFavorite,
  } = useNotesStore();

  const rootFolders = folders.filter(f => f.parentId === null);
  const favorites = notes.filter(n => n.isFavorite);
  const unfiled = notes.filter(n => n.folderId === null);

  return (
    <div className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-indigo-600">NoteAI</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <SidebarSection
          label="收藏"
          notes={favorites}
          activeNoteId={activeNoteId}
          onNoteClick={setActiveNote}
          onDeleteNote={deleteNote}
          onToggleFavorite={toggleFavorite}
        />

        <div className="mt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">文件夹</span>
            <button
              onClick={() => {
                const name = prompt('新建文件夹名称');
                if (name?.trim()) createFolder(name.trim());
              }}
              className="text-slate-400 hover:text-indigo-600 text-lg leading-none"
              title="新建文件夹"
            >+</button>
          </div>

          {rootFolders.map(folder => (
            <FolderItem
              key={folder.id}
              folder={folder}
              folders={folders}
              notes={notes}
              activeFolderId={activeFolderId}
              activeNoteId={activeNoteId}
              onFolderClick={setActiveFolder}
              onNoteClick={setActiveNote}
              onCreateNote={createNote}
              onCreateSubfolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onDeleteNote={deleteNote}
              onToggleFavorite={toggleFavorite}
              depth={0}
            />
          ))}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">未归档</span>
            <button
              onClick={() => createNote(null)}
              className="text-slate-400 hover:text-indigo-600 text-lg leading-none"
              title="新建笔记"
            >+</button>
          </div>
          {unfiled.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              active={note.id === activeNoteId}
              onNoteClick={setActiveNote}
              onDeleteNote={deleteNote}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  label, notes, activeNoteId, onNoteClick, onDeleteNote, onToggleFavorite,
}: {
  label: string;
  notes: Note[];
  activeNoteId: string | null;
  onNoteClick: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="px-2 mb-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {notes.map(note => (
        <NoteItem
          key={note.id}
          note={note}
          active={note.id === activeNoteId}
          onNoteClick={onNoteClick}
          onDeleteNote={onDeleteNote}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

function FolderItem({
  folder, folders, notes, activeFolderId, activeNoteId,
  onFolderClick, onNoteClick, onCreateNote, onCreateSubfolder,
  onRenameFolder, onDeleteFolder, onDeleteNote, onToggleFavorite, depth,
}: {
  folder: Folder;
  folders: Folder[];
  notes: Note[];
  activeFolderId: string | null;
  activeNoteId: string | null;
  onFolderClick: (id: string) => void;
  onNoteClick: (id: string) => void;
  onCreateNote: (folderId: string) => void;
  onCreateSubfolder: (name: string, parentId: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const children = folders.filter(f => f.parentId === folder.id);
  const folderNotes = notes.filter(n => n.folderId === folder.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const isActive = activeFolderId === folder.id;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-100 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
        onClick={() => { setExpanded(e => !e); onFolderClick(folder.id); }}
        onMouseLeave={() => setShowMenu(false)}
      >
        <span className="text-xs text-slate-400 w-3">{expanded ? '▼' : '▶'}</span>
        <span className="text-sm flex-1 truncate">{folder.name}</span>
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onCreateNote(folder.id); setExpanded(true); }}
            className="text-slate-400 hover:text-indigo-600 text-sm px-1"
            title="新建笔记"
          >📝</button>
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}
              className="text-slate-400 hover:text-slate-600 text-sm px-1"
              title="更多操作"
            >⋯</button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 w-32">
                <button
                  onClick={e => { e.stopPropagation(); const n = prompt('重命名', folder.name); if (n?.trim()) onRenameFolder(folder.id, n.trim()); setShowMenu(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                >重命名</button>
                <button
                  onClick={e => { e.stopPropagation(); const n = prompt('子文件夹名称'); if (n?.trim()) onCreateSubfolder(n.trim(), folder.id); setShowMenu(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                >新建子文件夹</button>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm(`删除文件夹 "${folder.name}"？`)) onDeleteFolder(folder.id); setShowMenu(false); }}
                  className="block w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                >删除</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <>
          {children.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              folders={folders}
              notes={notes}
              activeFolderId={activeFolderId}
              activeNoteId={activeNoteId}
              onFolderClick={onFolderClick}
              onNoteClick={onNoteClick}
              onCreateNote={onCreateNote}
              onCreateSubfolder={onCreateSubfolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDeleteNote={onDeleteNote}
              onToggleFavorite={onToggleFavorite}
              depth={depth + 1}
            />
          ))}
          {folderNotes.map(note => (
            <div key={note.id} style={{ paddingLeft: (depth + 1) * 12 }}>
              <NoteItem
                note={note}
                active={note.id === activeNoteId}
                onNoteClick={onNoteClick}
                onDeleteNote={onDeleteNote}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function NoteItem({
  note, active, onNoteClick, onDeleteNote, onToggleFavorite,
}: {
  note: Note;
  active: boolean;
  onNoteClick: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
      onClick={() => onNoteClick(note.id)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <span className="text-xs text-slate-300">📄</span>
      <span className="text-sm flex-1 truncate">{note.title || '无标题'}</span>
      {note.isFavorite && <span className="text-xs text-yellow-400">★</span>}
      <div className="hidden group-hover:flex items-center">
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}
            className="text-slate-400 hover:text-slate-600 text-sm px-1"
          >⋯</button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 w-28">
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorite(note.id); setShowMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
              >{note.isFavorite ? '取消收藏' : '收藏'}</button>
              <button
                onClick={e => { e.stopPropagation(); if (confirm('删除此笔记？')) onDeleteNote(note.id); setShowMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
              >删除</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

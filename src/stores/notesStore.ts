import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Folder, Note } from '../types';
import * as db from '../services/db';

interface NotesState {
  folders: Folder[];
  notes: Note[];
  activeNoteId: string | null;
  activeFolderId: string | null;
  searchQuery: string;
  searchResults: Note[];
  isSearching: boolean;

  loadAll: () => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createNote: (folderId?: string | null) => Promise<Note>;
  updateNote: (id: string, changes: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  setActiveFolder: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  setSearchQuery: (q: string) => Promise<void>;
  clearSearch: () => void;
  getActiveNote: () => Note | undefined;
  getNotesInFolder: (folderId: string | null) => Note[];
}

export const useNotesStore = create<NotesState>((set, get) => ({
  folders: [],
  notes: [],
  activeNoteId: null,
  activeFolderId: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  loadAll: async () => {
    const [folders, notes] = await Promise.all([db.getAllFolders(), db.getAllNotes()]);
    set({ folders, notes });
  },

  createFolder: async (name, parentId = null) => {
    const folder: Folder = {
      id: uuidv4(),
      name,
      parentId,
      order: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.createFolder(folder);
    set(s => ({ folders: [...s.folders, folder] }));
    return folder;
  },

  renameFolder: async (id, name) => {
    await db.updateFolder(id, { name, updatedAt: new Date() });
    set(s => ({
      folders: s.folders.map(f => f.id === id ? { ...f, name, updatedAt: new Date() } : f),
    }));
  },

  deleteFolder: async (id) => {
    await db.deleteFolder(id);
    const state = get();
    const deletedIds = new Set<string>();
    const collect = (fid: string) => {
      deletedIds.add(fid);
      state.folders.filter(f => f.parentId === fid).forEach(f => collect(f.id));
    };
    collect(id);
    set(s => ({
      folders: s.folders.filter(f => !deletedIds.has(f.id)),
      notes: s.notes.filter(n => n.folderId === null || !deletedIds.has(n.folderId)),
      activeNoteId: deletedIds.has(s.activeFolderId ?? '') ? null : s.activeNoteId,
      activeFolderId: deletedIds.has(s.activeFolderId ?? '') ? null : s.activeFolderId,
    }));
  },

  createNote: async (folderId = null) => {
    const note: Note = {
      id: uuidv4(),
      title: '无标题笔记',
      content: '',
      contentText: '',
      folderId,
      tags: [],
      summary: null,
      isFavorite: false,
      wordCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.createNote(note);
    set(s => ({ notes: [note, ...s.notes], activeNoteId: note.id }));
    return note;
  },

  updateNote: async (id, changes) => {
    await db.updateNote(id, changes);
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, ...changes, updatedAt: new Date() } : n),
    }));
  },

  deleteNote: async (id) => {
    await db.deleteNote(id);
    set(s => ({
      notes: s.notes.filter(n => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }));
  },

  setActiveNote: (id) => set({ activeNoteId: id }),
  setActiveFolder: (id) => set({ activeFolderId: id, activeNoteId: null }),

  toggleFavorite: async (id) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;
    const isFavorite = !note.isFavorite;
    await db.updateNote(id, { isFavorite });
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, isFavorite } : n),
    }));
  },

  setSearchQuery: async (q) => {
    if (!q.trim()) {
      set({ searchQuery: q, searchResults: [], isSearching: false });
      return;
    }
    set({ searchQuery: q, isSearching: true });
    const results = await db.searchNotes(q);
    set({ searchResults: results, isSearching: false });
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [], isSearching: false }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find(n => n.id === activeNoteId);
  },

  getNotesInFolder: (folderId) => {
    return get().notes.filter(n => n.folderId === folderId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
}));

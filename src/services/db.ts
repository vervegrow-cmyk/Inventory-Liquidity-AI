import Dexie, { type Table } from 'dexie';
import type { Folder, Note } from '../types';

class NoteDatabase extends Dexie {
  folders!: Table<Folder>;
  notes!: Table<Note>;

  constructor() {
    super('NoteAI');
    this.version(1).stores({
      folders: 'id, parentId, order, createdAt',
      notes: 'id, folderId, isFavorite, updatedAt, *tags',
    });
  }
}

export const db = new NoteDatabase();

export async function getAllFolders(): Promise<Folder[]> {
  return db.folders.orderBy('order').toArray();
}

export async function createFolder(folder: Folder): Promise<void> {
  await db.folders.add(folder);
}

export async function updateFolder(id: string, changes: Partial<Folder>): Promise<void> {
  await db.folders.update(id, changes);
}

export async function deleteFolder(id: string): Promise<void> {
  const children = await db.folders.where('parentId').equals(id).toArray();
  for (const child of children) {
    await deleteFolder(child.id);
  }
  await db.notes.where('folderId').equals(id).delete();
  await db.folders.delete(id);
}

export async function getNotesByFolder(folderId: string | null): Promise<Note[]> {
  if (folderId === null) {
    // IndexedDB doesn't reliably index null — use filter() instead of where().equals(null)
    return db.notes.filter(n => n.folderId === null).toArray();
  }
  return db.notes.where('folderId').equals(folderId).reverse().sortBy('updatedAt');
}

export async function getAllNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray();
}

export async function getNoteById(id: string): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function createNote(note: Note): Promise<void> {
  await db.notes.add(note);
}

export async function updateNote(id: string, changes: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export async function searchNotes(query: string): Promise<Note[]> {
  const lower = query.toLowerCase();
  return db.notes.filter(note =>
    note.title.toLowerCase().includes(lower) ||
    note.contentText.toLowerCase().includes(lower)
  ).toArray();
}

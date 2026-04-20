import { db } from '../services/db';
import type { Note } from '../types';

export async function findAllNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray();
}

export async function findNoteById(id: string): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function findNotesByFolder(folderId: string | null): Promise<Note[]> {
  if (folderId === null) {
    // IndexedDB doesn't reliably index null — use filter() instead of where().equals(null)
    return db.notes.filter(n => n.folderId === null).toArray();
  }
  return db.notes.where('folderId').equals(folderId).reverse().sortBy('updatedAt');
}

export async function searchNotes(query: string): Promise<Note[]> {
  const lower = query.toLowerCase();
  return db.notes.filter(note =>
    note.title.toLowerCase().includes(lower) ||
    note.contentText.toLowerCase().includes(lower)
  ).toArray();
}

export async function insertNote(note: Note): Promise<void> {
  await db.notes.add(note);
}

export async function updateNote(id: string, changes: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...changes, updatedAt: new Date() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

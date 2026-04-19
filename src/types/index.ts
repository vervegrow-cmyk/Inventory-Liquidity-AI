export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  contentText: string;
  folderId: string | null;
  tags: string[];
  summary: string | null;
  isFavorite: boolean;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

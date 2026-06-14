export interface Page {
  pageNumber: number;
  imageUrl: string;
}

export interface Chapter {
  id: string;
  title: string;
  pages: string[]; // URLs or Blob URLs
}

export interface Manga {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  chapters: Chapter[];
  isImported?: boolean;
  genres?: string[];
  popularity?: number;
  isOriginal?: boolean;
  originalTitle?: string;
  artist?: string;
  status?: string;
  type?: string;
  year?: number;
  views?: string;
}

export interface ReadingProgress {
  mangaId: string;
  chapterId: string;
  pageIndex: number;
  scrollPercent: number;
}

export type Theme = 'light' | 'sepia' | 'charcoal' | 'oled';
export type ReadingMode = 'vertical' | 'horizontal';

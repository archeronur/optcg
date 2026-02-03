export interface Card {
  id: string;
  name: string;
  set_code: string;
  set_name: string;
  number: string;
  rarity: string;
  image_uris: {
    full: string;
    large: string;
    small: string;
  };
  colors?: string[];
  cost?: number;
  type?: string;
  subtypes?: string[];
  characteristics?: string[];
  text?: string;
  flavor_text?: string;
  artist?: string;
  // Variant info for alternate arts, parallels, SP cards
  variant?: 'standard' | 'parallel' | 'alternate-art' | 'sp' | 'manga' | 'promo';
  variantLabel?: string; // e.g., "P1", "AA", "SP", "Manga"
}

export interface DeckCard {
  card: Card;
  count: number;
}

export interface ParsedDeckEntry {
  name: string;
  set_code?: string;
  number?: string;
  count: number;
  original_line: string;
}

export interface PrintSettings {
  grid: '3x3' | '3x4' | '4x3';
  includeBleed: boolean;
  includeCropMarks: boolean;
  includeBackPages: boolean;
  backMirrorHorizontally?: boolean;
  safeMargin: number; // mm
  bleedSize: number; // mm
  // Kesim işaretleri için gelişmiş ayarlar
  cropMarkLengthMm?: number; // mm
  cropMarkOffsetMm?: number; // mm (trim hattından dışarı doğru boşluk)
  cropMarkThicknessPt?: number; // pt
}

export interface LayoutDimensions {
  pageWidth: number; // mm
  pageHeight: number; // mm
  cardWidth: number; // mm
  cardHeight: number; // mm
  cols: number;
  rows: number;
  gutterX: number; // mm
  gutterY: number; // mm
  marginX: number; // mm
  marginY: number; // mm
}

export interface APIResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type Language = 'tr' | 'en';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

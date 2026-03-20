// Matches the raw Draft.js ContentState format stored in the database
export interface RawDraftBlock {
  key: string;
  text: string;
  type: string;
  depth: number;
  inlineStyleRanges: Array<{ offset: number; length: number; style: string }>;
  entityRanges: Array<{ offset: number; length: number; key: number }>;
  data?: Record<string, unknown>;
}

export interface RawDraftEntity {
  type: string;
  mutability: string;
  data: Record<string, unknown>;
}

export interface RawDraftContent {
  blocks: RawDraftBlock[];
  entityMap: Record<string | number, RawDraftEntity>;
}

// ─── Domain types ───────────────────────────────────────────────────────────

export interface FaqItemData {
  id: string;
  title: string;
  content: string;
  position: number;
}

export interface FaqCategoryData {
  id: string;
  title: string;
  position: number;
  items: FaqItemData[];
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface FaqCategoryCreated {
  id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FaqCategoryUpdated {
  id: string;
  title: string;
  position: number;
  updated_at: string;
}

export interface FaqItemCreated {
  id: string;
  category_id: string;
  title: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FaqItemUpdated {
  id: string;
  category_id: string;
  title: string;
  content: string;
  position: number;
  updated_at: string;
}

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

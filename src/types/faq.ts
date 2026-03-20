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
  createdAt: string;
  updatedAt: string;
}

export interface FaqCategoryUpdated {
  id: string;
  title: string;
  position: number;
  updatedAt: string;
}

export interface FaqItemCreated {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface FaqItemUpdated {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  position: number;
  updatedAt: string;
}

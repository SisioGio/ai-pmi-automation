import categories from "../../../catalog/categories.json";

export interface Category {
  id: string;
  nome: string;
  problema: string;
  esempio: string;
}

export const CATEGORIES: Category[] = categories;

export const isCategoryId = (id: unknown): id is string =>
  typeof id === "string" && CATEGORIES.some((c) => c.id === id);

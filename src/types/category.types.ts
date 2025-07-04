// types/category.types.ts
import type { Category as CategoryType } from "../models/category.model";
export type Category = CategoryType;

export interface NewCategory {
  name: string;
}

// repositories/category.repository.ts
import pool from "../db/pool";
import { Category, NewCategory } from "../types/category.types";

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    const { rows } = await pool.query<Category>(
      "SELECT * FROM categories ORDER BY id"
    );
    return rows;
  }

  async findById(id: number): Promise<Category | null> {
    const { rows } = await pool.query<Category>(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );
    return rows[0] || null;
  }

  async create(data: NewCategory): Promise<Category> {
    const { rows } = await pool.query<Category>(
      "INSERT INTO categories (name) VALUES ($1) RETURNING *",
      [data.name]
    );
    return rows[0];
  }

  async update(id: number, data: NewCategory): Promise<Category | null> {
    const { rows } = await pool.query<Category>(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING *",
      [data.name, id]
    );
    return rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      "DELETE FROM categories WHERE id = $1",
      [id]
    );
    return rowCount ? rowCount > 0 : false;
  }
}

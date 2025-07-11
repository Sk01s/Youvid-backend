import pool from "../db/pool";

export interface Category {
  id: number;
  name: string;
}

export const createCategoriesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      name VARCHAR(50) UNIQUE NOT NULL
    )
  `);
};

export const seedCategories = async () => {
  const defaultCategories = [
    "Music",
    "Gaming",
    "Education",
    "Entertainment",
    "Technology",
    "Sports",
    "Travel",
    "Food",
  ];

  for (const name of defaultCategories) {
    try {
      await pool.query(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    } catch (err) {
      console.error("Error seeding category:", name, err);
    }
  }
};

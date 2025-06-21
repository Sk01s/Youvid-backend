import { RequestHandler } from "express";
import pool, { Category } from "../models";

export class CategoryController {
  static getAll: RequestHandler = async (req, res) => {
    try {
      const { rows } = await pool.query<Category>(
        "SELECT * FROM categories ORDER BY id"
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static getById: RequestHandler = async (req, res) => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query<Category>(
        "SELECT * FROM categories WHERE id = $1",
        [id]
      );

      if (rows.length === 0) {
        res.status(404).json({ message: "Category not found" });
        return;
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("Error fetching category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static create: RequestHandler = async (req, res) => {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    try {
      const { rows } = await pool.query<Category>(
        "INSERT INTO categories (name) VALUES ($1) RETURNING *",
        [name]
      );

      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ message: "Category name already exists" });
        return;
      }
      console.error("Error creating category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static update: RequestHandler = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    try {
      const { rowCount, rows } = await pool.query<Category>(
        "UPDATE categories SET name = $1 WHERE id = $2 RETURNING *",
        [name, id]
      );

      if (rowCount === 0) {
        res.status(404).json({ message: "Category not found" });
        return;
      }

      res.json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ message: "Category name already exists" });
        return;
      }
      console.error("Error updating category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static delete: RequestHandler = async (req, res) => {
    const { id } = req.params;

    try {
      const { rowCount } = await pool.query(
        "DELETE FROM categories WHERE id = $1",
        [id]
      );

      if (rowCount === 0) {
        res.status(404).json({ message: "Category not found" });
        return;
      }

      res.status(204).send();
    } catch (err: any) {
      if (err.code === "23503") {
        res.status(400).json({
          message: "Cannot delete category - it's being used by videos",
        });
        return;
      }

      console.error("Error deleting category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };
}

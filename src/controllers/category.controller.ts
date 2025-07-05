// controllers/categoryController.ts
import { Request, Response } from "express";
import { CategoryRepository } from "../repositories/category.repository";
import { NewCategory } from "../types/category.types";

const repo = new CategoryRepository();

export class CategoryController {
  static getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await repo.findAll();
      res.json(categories);
    } catch (err) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static getById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    try {
      const category = await repo.findById(id);
      if (!category) {
        res.status(404).json({ message: "Category not found" });
        return;
      }
      res.json(category);
    } catch (err) {
      console.error("Error fetching category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static create = async (req: Request, res: Response): Promise<void> => {
    const payload: NewCategory = req.body;
    if (!payload.name) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    try {
      const category = await repo.create(payload);
      res.status(201).json(category);
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ message: "Category name already exists" });
        return;
      }
      console.error("Error creating category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const payload: NewCategory = req.body;
    if (!payload.name) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    try {
      const updated = await repo.update(id, payload);
      if (!updated) {
        res.status(404).json({ message: "Category not found" });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      if (err.code === "23505") {
        res.status(409).json({ message: "Category name already exists" });
        return;
      }
      console.error("Error updating category:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  static delete = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    try {
      const deleted = await repo.delete(id);
      if (!deleted) {
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

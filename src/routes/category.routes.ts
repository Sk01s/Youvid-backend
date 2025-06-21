import { Router } from "express";
import { CategoryController } from "../controllers/category.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", CategoryController.getAll);
router.get("/:id", CategoryController.getById);

// Protected routes (require authentication)
router.use(authenticate);
router.post("/", CategoryController.create);
router.put("/:id", CategoryController.update);
router.delete("/:id", CategoryController.delete);

export default router;

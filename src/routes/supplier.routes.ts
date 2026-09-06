import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { supplierController } from "../controllers/supplier.controller";

export const supplierRouter = Router();

supplierRouter.use(requireAuth, requireRole(...MODULE_ROLES["supplier"]));

supplierRouter.get("/", supplierController.list);
supplierRouter.get("/stats", supplierController.stats);
supplierRouter.get("/:id", supplierController.get);
supplierRouter.post("/", supplierController.create);
supplierRouter.put("/:id", supplierController.update);
supplierRouter.delete("/:id", supplierController.remove);

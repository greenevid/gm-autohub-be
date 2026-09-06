import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { returController } from "../controllers/retur.controller";

export const returRouter = Router();

returRouter.use(requireAuth, requireRole(...MODULE_ROLES["penjualan"]));

returRouter.get("/", returController.list);
returRouter.get("/:id", returController.get);
returRouter.post("/", returController.create);
returRouter.put("/:id", returController.update);
returRouter.delete("/:id", returController.remove);

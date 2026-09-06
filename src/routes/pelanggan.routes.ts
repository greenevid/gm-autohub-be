import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pelangganController } from "../controllers/pelanggan.controller";

export const pelangganRouter = Router();

pelangganRouter.use(requireAuth, requireRole(...MODULE_ROLES["pelanggan"]));

pelangganRouter.get("/", pelangganController.list);
pelangganRouter.get("/stats", pelangganController.stats);
pelangganRouter.get("/:id", pelangganController.get);
pelangganRouter.post("/", pelangganController.create);
pelangganRouter.put("/:id", pelangganController.update);
pelangganRouter.delete("/:id", pelangganController.remove);

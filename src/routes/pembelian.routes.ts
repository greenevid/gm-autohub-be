import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pembelianController } from "../controllers/pembelian.controller";

export const pembelianRouter = Router();

pembelianRouter.use(requireAuth, requireRole(...MODULE_ROLES["pembelian"]));

pembelianRouter.get("/", pembelianController.list);
pembelianRouter.get("/:id", pembelianController.get);
pembelianRouter.post("/", pembelianController.create);
pembelianRouter.put("/:id", pembelianController.update);
pembelianRouter.delete("/:id", pembelianController.remove);

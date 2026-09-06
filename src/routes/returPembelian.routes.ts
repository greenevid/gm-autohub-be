import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { returPembelianController } from "../controllers/returPembelian.controller";

export const returPembelianRouter = Router();

returPembelianRouter.use(requireAuth, requireRole(...MODULE_ROLES["pembelian"]));

returPembelianRouter.get("/", returPembelianController.list);
returPembelianRouter.get("/:id", returPembelianController.get);
returPembelianRouter.post("/", returPembelianController.create);
returPembelianRouter.delete("/:id", returPembelianController.remove);

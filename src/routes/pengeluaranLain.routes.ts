import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pengeluaranLainController } from "../controllers/pengeluaranLain.controller";

export const pengeluaranLainRouter = Router();

pengeluaranLainRouter.use(requireAuth, requireRole(...MODULE_ROLES["pembelian"]));

pengeluaranLainRouter.get("/", pengeluaranLainController.list);
pengeluaranLainRouter.get("/:id", pengeluaranLainController.get);
pengeluaranLainRouter.post("/", pengeluaranLainController.create);
pengeluaranLainRouter.put("/:id", pengeluaranLainController.update);
pengeluaranLainRouter.delete("/:id", pengeluaranLainController.remove);

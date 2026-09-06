import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { periodeGajiController } from "../controllers/periodeGaji.controller";

export const periodeGajiRouter = Router();

periodeGajiRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-karyawan"]));

periodeGajiRouter.get("/", periodeGajiController.list);
periodeGajiRouter.get("/:id", periodeGajiController.get);
periodeGajiRouter.post("/", periodeGajiController.create);
periodeGajiRouter.delete("/:id", periodeGajiController.remove);

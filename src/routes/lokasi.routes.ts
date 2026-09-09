import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { lokasiController } from "../controllers/lokasi.controller";

export const lokasiRouter = Router();

lokasiRouter.use(requireAuth, requireRole(...MODULE_ROLES["pengaturan"]));

lokasiRouter.get("/", lokasiController.list);
lokasiRouter.get("/:id", lokasiController.get);
lokasiRouter.post("/", lokasiController.create);
lokasiRouter.put("/:id", lokasiController.update);
lokasiRouter.delete("/:id", lokasiController.remove);

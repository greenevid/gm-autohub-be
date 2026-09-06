import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { posisiController } from "../controllers/posisi.controller";

export const posisiRouter = Router();

posisiRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-karyawan"]));

posisiRouter.get("/", posisiController.list);
posisiRouter.get("/:id", posisiController.get);
posisiRouter.post("/", posisiController.create);
posisiRouter.put("/:id", posisiController.update);
posisiRouter.delete("/:id", posisiController.remove);

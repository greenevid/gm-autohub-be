import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { karyawanController } from "../controllers/karyawan.controller";

export const karyawanRouter = Router();

karyawanRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-karyawan"]));

karyawanRouter.get("/", karyawanController.list);
karyawanRouter.get("/stats", karyawanController.stats);
karyawanRouter.get("/:id", karyawanController.get);
karyawanRouter.post("/", karyawanController.create);
karyawanRouter.put("/:id", karyawanController.update);
karyawanRouter.delete("/:id", karyawanController.remove);

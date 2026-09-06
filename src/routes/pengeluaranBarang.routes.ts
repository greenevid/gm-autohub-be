import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pengeluaranBarangController } from "../controllers/pengeluaranBarang.controller";

export const pengeluaranBarangRouter = Router();

pengeluaranBarangRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-stok"]));

pengeluaranBarangRouter.get("/", pengeluaranBarangController.list);
pengeluaranBarangRouter.get("/:id", pengeluaranBarangController.get);
pengeluaranBarangRouter.post("/", pengeluaranBarangController.create);
pengeluaranBarangRouter.put("/:id", pengeluaranBarangController.update);
pengeluaranBarangRouter.delete("/:id", pengeluaranBarangController.remove);

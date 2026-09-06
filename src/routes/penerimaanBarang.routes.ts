import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { penerimaanBarangController } from "../controllers/penerimaanBarang.controller";

export const penerimaanBarangRouter = Router();

penerimaanBarangRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-stok"]));

penerimaanBarangRouter.get("/", penerimaanBarangController.list);
penerimaanBarangRouter.get("/:id", penerimaanBarangController.get);
penerimaanBarangRouter.post("/", penerimaanBarangController.create);
penerimaanBarangRouter.put("/:id", penerimaanBarangController.update);
penerimaanBarangRouter.delete("/:id", penerimaanBarangController.remove);

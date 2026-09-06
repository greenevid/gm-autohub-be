import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { barangController } from "../controllers/barang.controller";
import { uploadXlsx } from "../middlewares/upload";

export const barangRouter = Router();

barangRouter.use(requireAuth, requireRole(...MODULE_ROLES["barang-jasa"]));

barangRouter.get("/template", barangController.template);
barangRouter.get("/export", barangController.exportXlsx);
barangRouter.post("/import", uploadXlsx, barangController.importXlsx);
barangRouter.get("/", barangController.list);
barangRouter.get("/:id", barangController.get);
barangRouter.post("/", barangController.create);
barangRouter.put("/:id", barangController.update);
barangRouter.delete("/:id", barangController.remove);

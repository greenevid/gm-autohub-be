import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { jasaController } from "../controllers/jasa.controller";
import { uploadXlsx } from "../middlewares/upload";

export const jasaRouter = Router();

jasaRouter.use(requireAuth, requireRole(...MODULE_ROLES["barang-jasa"]));

jasaRouter.get("/template", jasaController.template);
jasaRouter.get("/export", jasaController.exportXlsx);
jasaRouter.post("/import", uploadXlsx, jasaController.importXlsx);
jasaRouter.get("/", jasaController.list);
jasaRouter.get("/:id", jasaController.get);
jasaRouter.post("/", jasaController.create);
jasaRouter.put("/:id", jasaController.update);
jasaRouter.delete("/:id", jasaController.remove);

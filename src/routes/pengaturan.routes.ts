import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { companyProfileController, lookupController, pajakController } from "../controllers/pengaturan.controller";

export const pengaturanRouter = Router();

pengaturanRouter.use(requireAuth, requireRole(...MODULE_ROLES["pengaturan"]));

pengaturanRouter.get("/lookup", lookupController.list);
pengaturanRouter.post("/lookup", lookupController.create);
pengaturanRouter.put("/lookup/:id", lookupController.update);
pengaturanRouter.delete("/lookup/:id", lookupController.remove);

pengaturanRouter.get("/pajak", pajakController.get);
pengaturanRouter.put("/pajak", pajakController.update);

pengaturanRouter.put("/profil-perusahaan", companyProfileController.update);

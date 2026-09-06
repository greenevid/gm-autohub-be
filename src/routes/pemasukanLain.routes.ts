import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pemasukanLainController } from "../controllers/pemasukanLain.controller";

export const pemasukanLainRouter = Router();

pemasukanLainRouter.use(requireAuth, requireRole(...MODULE_ROLES["penjualan"]));

pemasukanLainRouter.get("/", pemasukanLainController.list);
pemasukanLainRouter.get("/:id", pemasukanLainController.get);
pemasukanLainRouter.post("/", pemasukanLainController.create);
pemasukanLainRouter.put("/:id", pemasukanLainController.update);
pemasukanLainRouter.delete("/:id", pemasukanLainController.remove);

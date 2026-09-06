import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { paketController } from "../controllers/paket.controller";

export const paketRouter = Router();

paketRouter.use(requireAuth, requireRole(...MODULE_ROLES["barang-jasa"]));

paketRouter.get("/", paketController.list);
paketRouter.get("/:id", paketController.get);
paketRouter.post("/", paketController.create);
paketRouter.put("/:id", paketController.update);
paketRouter.delete("/:id", paketController.remove);

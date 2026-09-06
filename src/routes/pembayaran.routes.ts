import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pembayaranController } from "../controllers/pembayaran.controller";

export const pembayaranRouter = Router();

pembayaranRouter.use(requireAuth, requireRole(...MODULE_ROLES["penjualan"]));

pembayaranRouter.get("/", pembayaranController.list);
pembayaranRouter.post("/", pembayaranController.create);
pembayaranRouter.delete("/:id", pembayaranController.remove);

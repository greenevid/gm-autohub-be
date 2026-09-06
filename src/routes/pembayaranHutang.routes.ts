import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { pembayaranHutangController } from "../controllers/pembayaranHutang.controller";

export const pembayaranHutangRouter = Router();

pembayaranHutangRouter.use(requireAuth, requireRole(...MODULE_ROLES["pembelian"]));

pembayaranHutangRouter.get("/", pembayaranHutangController.list);
pembayaranHutangRouter.post("/", pembayaranHutangController.create);
pembayaranHutangRouter.delete("/:id", pembayaranHutangController.remove);

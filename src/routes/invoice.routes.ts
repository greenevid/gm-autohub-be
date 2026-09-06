import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { invoiceController } from "../controllers/invoice.controller";

export const invoiceRouter = Router();

invoiceRouter.use(requireAuth, requireRole(...MODULE_ROLES["penjualan"]));

invoiceRouter.get("/", invoiceController.list);
invoiceRouter.get("/:id", invoiceController.get);
invoiceRouter.post("/", invoiceController.create);
invoiceRouter.put("/:id", invoiceController.update);
invoiceRouter.delete("/:id", invoiceController.remove);

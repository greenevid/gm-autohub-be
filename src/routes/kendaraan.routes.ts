import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { kendaraanController } from "../controllers/kendaraan.controller";

export const kendaraanRouter = Router();

kendaraanRouter.use(requireAuth);

kendaraanRouter.get("/", kendaraanController.list);
kendaraanRouter.get("/:id", kendaraanController.get);
kendaraanRouter.post("/", kendaraanController.create);
kendaraanRouter.put("/:id", kendaraanController.update);
kendaraanRouter.delete("/:id", kendaraanController.remove);

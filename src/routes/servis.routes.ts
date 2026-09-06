import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { servisController } from "../controllers/servis.controller";

export const servisRouter = Router();

servisRouter.use(requireAuth);

servisRouter.get("/", servisController.list);
servisRouter.get("/:id", servisController.get);
servisRouter.post("/", servisController.create);
servisRouter.put("/:id", servisController.update);
servisRouter.delete("/:id", servisController.remove);

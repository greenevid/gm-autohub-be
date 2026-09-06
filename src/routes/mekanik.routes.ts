import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { mekanikController } from "../controllers/mekanik.controller";

export const mekanikRouter = Router();

mekanikRouter.use(requireAuth);

mekanikRouter.get("/", mekanikController.list);
mekanikRouter.get("/:id", mekanikController.get);
mekanikRouter.post("/", mekanikController.create);
mekanikRouter.put("/:id", mekanikController.update);
mekanikRouter.delete("/:id", mekanikController.remove);

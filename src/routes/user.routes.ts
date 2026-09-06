import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";

export const userRouter = Router();

userRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-user"]));

userRouter.get("/", userController.list);
userRouter.get("/:id", userController.get);
userRouter.post("/", userController.create);
userRouter.put("/:id", userController.update);
userRouter.delete("/:id", userController.remove);

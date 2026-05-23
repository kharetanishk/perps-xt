import { Router } from "express";
import { verifyToken } from "../middleware/requireAuth";
import { getUserInfo } from "../controller/user.controller";

const userRoute: Router = Router();

userRoute.get("/me", verifyToken, getUserInfo);

export default userRoute;

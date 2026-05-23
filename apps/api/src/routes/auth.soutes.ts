import { Router } from "express";
import { registerUser } from "../controller/auth.controller";

const authRoute: Router = Router();

authRoute.post("/signup", registerUser);
// authRoute.post("/signin", loginUser);

export default authRoute;

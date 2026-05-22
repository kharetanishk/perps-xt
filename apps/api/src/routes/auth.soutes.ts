import { Router } from "express";

const authRoute = Router();

authRoute.post("/signup", registerUser);
authRoute.post("/signin", loginUser);

export default authRoute;

import express from "express";
import { Express } from "express";
import { Response } from "express";
import cors from "cors";
import authRoute from "./routes/auth.soutes";
import userRoute from "./routes/user.routes";

const app: Express = express();

//middleware
app.use(cors());
app.use(express.json());

//health
app.get("/api/v2/health", (_req, res: Response) => {
  res.status(200).json({ status: "active" });
});

//route
app.use("/api/v2/auth", authRoute);
app.use("/api/v2/user", userRoute);

export default app;

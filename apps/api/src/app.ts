import express from "express";
import { Express, Response } from "express";
import cors from "cors";
import authRoute from "./routes/auth.routes";
import userRoute from "./routes/user.routes";
import { ordersRoute } from "./routes/orders.routes";
import { balanceRoute } from "./routes/balance.routes";
import { depthRoute } from "./routes/depth.routes";
import { positionsRoute } from "./routes/positions.routes";

const app: Express = express();
app.use(cors());
app.use(express.json());

app.get("/api/v2/health", (_req, res: Response) => {
  res.status(200).json({ status: "active" });
});

app.use("/api/v2/auth", authRoute);
app.use("/api/v2/user", userRoute);
app.use("/api/v2/order", ordersRoute);
app.use("/api/v2/balance", balanceRoute);
app.use("/api/v2/depth", depthRoute);
app.use("/api/v2/positions", positionsRoute);

export default app;

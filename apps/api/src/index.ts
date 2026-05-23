import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { Response } from "express";
import cors from "cors";
import authRoute from "./routes/auth.soutes";
const app = express();
const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());

app.get("/api/v2/health", (_req, res: Response) => {
  res.status(200).json({
    status: "active",
    message: `the api is running`,
  });
});

//routes
app.use("/api/v2/auth", authRoute);

app.listen(PORT, () => {
  console.log(`the app is listening to port ${PORT}`);
});

import express from "express";
import { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());

app.get("/api/v2/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "active",
    message: `the api is running`,
  });
});

//routes

app.listen(PORT, () => {
  console.log(`the app is listening to port ${PORT}`);
});

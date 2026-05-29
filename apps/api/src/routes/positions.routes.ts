import { Router } from "express";
import { verifyToken } from "../middleware/requireAuth";
import { sendToEngine } from "../utils/engineClient";

export const positionsRoute: Router = Router();

positionsRoute.get("/", verifyToken, async (req, res) => {
  try {
    const response = await sendToEngine("get_positions", req.userId, {});
    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }
    res.status(200).json(response.data);
  } catch {
    res.status(503).json({ error: "Engine unavailable" });
  }
});

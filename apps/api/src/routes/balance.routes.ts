import { Router } from "express";
import { verifyToken } from "../middleware/requireAuth";
import { sendToEngine } from "../utils/engineClient";

export const balanceRoute: Router = Router();

balanceRoute.post("/onramp", verifyToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  try {
    const response = await sendToEngine("onramp", req.userId, { amount });
    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }
    res.status(200).json(response.data);
  } catch {
    res.status(503).json({ error: "Engine unavailable" });
  }
});

balanceRoute.get("/", verifyToken, async (req, res) => {
  try {
    const response = await sendToEngine("get_balance", req.userId, {});
    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }
    res.status(200).json(response.data);
  } catch {
    res.status(503).json({ error: "Engine unavailable" });
  }
});

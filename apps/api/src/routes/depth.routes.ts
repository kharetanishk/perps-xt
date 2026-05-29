import { Router } from "express";
import { sendToEngine } from "../utils/engineClient";

export const depthRoute: Router = Router();

depthRoute.get("/:market", async (req, res) => {
  const { market } = req.params;
  try {
    const response = await sendToEngine("get_orderbook", "system", { market });
    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }
    res.status(200).json(response.data);
  } catch {
    res.status(503).json({ error: "Engine unavailable" });
  }
});

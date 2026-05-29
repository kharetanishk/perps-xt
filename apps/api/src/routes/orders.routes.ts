import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../middleware/requireAuth";
import { sendToEngine } from "../utils/engineClient";

export const ordersRoute: Router = Router();

const createOrderSchema = z.object({
  market: z.string().min(1),
  side: z.enum(["LONG", "SHORT"]),
  orderType: z.enum(["limit", "market"]),
  price: z.number().positive().optional(),
  qty: z.number().positive(),
});

ordersRoute.post("/", verifyToken, async (req, res) => {
  const result = createOrderSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { market, side, orderType, price, qty } = result.data;

  // validate limit order has price
  if (orderType === "limit" && !price) {
    res.status(400).json({ error: "Limit order requires a price" });
    return;
  }

  try {
    const response = await sendToEngine("create_order", req.userId, {
      market,
      side,
      orderType,
      price: price ?? null,
      qty,
      leverage: 10,
    });

    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }

    res.status(201).json(response.data);
  } catch (err) {
    console.error("[api] engine error:", err);
    res.status(503).json({ error: "Engine unavailable" });
  }
});
ordersRoute.get("/open", verifyToken, async (req, res) => {
  try {
    const response = await sendToEngine("get_open_orders", req.userId, {});

    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }

    res.status(200).json(response.data);
  } catch (err) {
    console.error("[api] engine error:", err);
    res.status(503).json({ error: "Engine unavailable" });
  }
});

ordersRoute.get("/fills", verifyToken, async (req, res) => {
  try {
    const response = await sendToEngine("get_fills", req.userId, {});

    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }

    res.status(200).json(response.data);
  } catch (err) {
    console.error("[api] engine error:", err);
    res.status(503).json({ error: "Engine unavailable" });
  }
});

ordersRoute.delete("/:orderId", verifyToken, async (req, res) => {
  const { orderId } = req.params;

  try {
    const response = await sendToEngine("cancel_order", req.userId, {
      orderId,
    });

    if (!response.ok) {
      res.status(400).json({ error: response.error });
      return;
    }

    res.status(200).json(response.data);
  } catch (err) {
    console.error("[api] engine error:", err);
    res.status(503).json({ error: "Engine unavailable" });
  }
});

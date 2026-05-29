import { v4 as uuid } from "uuid";
import type Redis from "ioredis";
import { lpush, QUEUES } from "@perps-xt/redis";
import type {
  CreateOrderPayload,
  EngineRequest,
  EngineResponse,
  OrderRecord,
} from "@perps-xt/types";
import { getOrCreateBalance, getOrCreateOrderbook, orders } from "../store";
import { matchOrder } from "../matching/match";
import { settleFill } from "../matching/settle";

const LEVERAGE = 10;

export async function handleCreateOrder(
  request: EngineRequest,
  redisClient: Redis,
): Promise<EngineResponse> {
  const payload = request.payload as unknown as CreateOrderPayload;

  // ── VALIDATION ────────────────────────────────────────────────────────────
  if (!payload.market || !payload.side || !payload.orderType) {
    return error(request.correlationId, "Missing required fields");
  }

  if (payload.orderType === "limit" && (!payload.price || payload.price <= 0)) {
    return error(request.correlationId, "Limit order requires a valid price");
  }

  if (!payload.qty || payload.qty <= 0) {
    return error(request.correlationId, "Invalid quantity");
  }

  // ── MARGIN CHECK ──────────────────────────────────────────────────────────
  const balance = getOrCreateBalance(request.userId);
  const price = payload.price ?? 0;
  const marginRequired =
    payload.orderType === "limit" ? (price * payload.qty) / LEVERAGE : 0;

  if (payload.orderType === "limit" && balance.available < marginRequired) {
    return error(request.correlationId, "Insufficient margin");
  }

  // ── BUILD ORDER RECORD ────────────────────────────────────────────────────
  const order: OrderRecord = {
    orderId: uuid(),
    userId: request.userId,
    market: payload.market,
    side: payload.side,
    orderType: payload.orderType,
    price: payload.orderType === "limit" ? payload.price! : null,
    qty: payload.qty,
    filledQty: 0,
    status: "open",
    margin: marginRequired,
    fills: [],
    createdAt: Date.now(),
  };

  // ── MATCH ─────────────────────────────────────────────────────────────────
  const book = getOrCreateOrderbook(payload.market);
  const { fills, order: updatedOrder } = matchOrder(order, book);

  // ── SETTLE + PUSH TO DB QUEUE ─────────────────────────────────────────────
  for (const fill of fills) {
    settleFill(fill, updatedOrder.side);
    updatedOrder.fills.push(fill);

    // push fill to db-poller queue — persisted asynchronously
    await lpush(redisClient, QUEUES.DB_WRITES, {
      type: "fill",
      payload: fill,
    });
  }

  // ── STORE IN MEMORY ───────────────────────────────────────────────────────
  orders.set(updatedOrder.orderId, updatedOrder);

  // push order to db-poller queue
  await lpush(redisClient, QUEUES.DB_WRITES, {
    type: "order",
    payload: updatedOrder,
  });

  return {
    correlationId: request.correlationId,
    ok: true,
    data: {
      orderId: updatedOrder.orderId,
      status: updatedOrder.status,
      fills: fills,
    },
  };
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

function error(correlationId: string, message: string): EngineResponse {
  return { correlationId, ok: false, error: message };
}

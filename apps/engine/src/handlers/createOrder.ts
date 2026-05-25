// apps/engine/src/handlers/createOrder.ts
// Validates, matches, settles one create_order request.
// Returns EngineResponse to be sent back to the API.

import { v4 as uuid } from "uuid";
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

export function handleCreateOrder(request: EngineRequest): EngineResponse {
  const payload = request.payload as unknown as CreateOrderPayload;

  //validation

  if (!payload.market || !payload.side || !payload.orderType) {
    return error(request.correlationId, "Missing required fields");
  }

  if (payload.orderType === "limit" && (!payload.price || payload.price <= 0)) {
    return error(request.correlationId, "Limit order requires a valid price");
  }

  if (!payload.qty || payload.qty <= 0) {
    return error(request.correlationId, "Invalid quantity");
  }

  //margin check

  const balance = getOrCreateBalance(request.userId);
  const price = payload.price ?? 0;
  const marginRequired =
    payload.orderType === "limit" ? (price * payload.qty) / LEVERAGE : 0; // market orders: margin checked after matching (we know the fill price)

  if (payload.orderType === "limit" && balance.available < marginRequired) {
    return error(request.correlationId, "Insufficient margin");
  }

  //build order records

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

  // match

  const book = getOrCreateOrderbook(payload.market);
  const { fills, order: updatedOrder } = matchOrder(order, book);

  // settle

  for (const fill of fills) {
    settleFill(fill, updatedOrder.side);
    updatedOrder.fills.push(fill);
  }

  // store

  orders.set(updatedOrder.orderId, updatedOrder);

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

function error(correlationId: string, message: string): EngineResponse {
  return { correlationId, ok: false, error: message };
}

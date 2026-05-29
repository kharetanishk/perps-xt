import type {
  EngineRequest,
  EngineResponse,
  CancelOrderPayload,
} from "@perps-xt/types";
import { orders, getOrCreateBalance, getOrCreateOrderbook } from "../store";
import { removeOrderFromBook } from "../matching/orderbook";

export function handleCancelOrder(request: EngineRequest): EngineResponse {
  const payload = request.payload as unknown as CancelOrderPayload;

  if (!payload.orderId) {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "orderId required",
    };
  }

  const order = orders.get(payload.orderId);

  if (!order) {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Order not found",
    };
  }

  if (order.userId !== request.userId) {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Unauthorized",
    };
  }

  if (order.status === "filled") {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Cannot cancel filled order",
    };
  }

  if (order.status === "cancelled") {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Already cancelled",
    };
  }

  // remove from orderbook
  if (order.status === "open" || order.status === "partially_filled") {
    const book = getOrCreateOrderbook(order.market);
    const remainingQty = order.qty - order.filledQty;

    removeOrderFromBook(book, {
      orderId: order.orderId,
      userId: order.userId,
      market: order.market,
      side: order.side,
      price: order.price!,
      qty: remainingQty,
      filledQty: 0,
      margin: order.margin,
      createdAt: order.createdAt,
    });

    // release margin proportional to remaining qty
    const remainingMargin = order.margin * (remainingQty / order.qty);
    const balance = getOrCreateBalance(order.userId);
    balance.locked -= remainingMargin;
    balance.available += remainingMargin;
  }

  order.status = "cancelled";

  return {
    correlationId: request.correlationId,
    ok: true,
    data: { orderId: order.orderId, status: "cancelled" },
  };
}

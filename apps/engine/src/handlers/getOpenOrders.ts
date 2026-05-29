import type { EngineRequest, EngineResponse } from "@perps-xt/types";
import { orders } from "../store";

export function handleGetOpenOrders(request: EngineRequest): EngineResponse {
  const userOrders = Array.from(orders.values()).filter(
    (o) =>
      o.userId === request.userId &&
      (o.status === "open" || o.status === "partially_filled"),
  );

  return { correlationId: request.correlationId, ok: true, data: userOrders };
}

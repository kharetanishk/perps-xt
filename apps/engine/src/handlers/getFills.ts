import type { EngineRequest, EngineResponse, Fill } from "@perps-xt/types";
import { orders } from "../store";

export function handleGetFills(request: EngineRequest): EngineResponse {
  const seen = new Set<string>();
  const userFills: Fill[] = [];

  for (const order of orders.values()) {
    for (const fill of order.fills) {
      if (
        (fill.makerUserId === request.userId ||
          fill.takerUserId === request.userId) &&
        !seen.has(fill.fillId)
      ) {
        seen.add(fill.fillId);
        userFills.push(fill);
      }
    }
  }

  userFills.sort((a, b) => a.timestamp - b.timestamp);

  return { correlationId: request.correlationId, ok: true, data: userFills };
}

import type { EngineRequest, EngineResponse } from "@perps-xt/types";
import { positions, getOrCreateOrderbook } from "../store";

export function handleGetPositions(request: EngineRequest): EngineResponse {
  const userPositions = positions.get(request.userId);

  if (!userPositions || userPositions.size === 0) {
    return { correlationId: request.correlationId, ok: true, data: [] };
  }

  const result = Array.from(userPositions.values()).map((pos) => {
    const book = getOrCreateOrderbook(pos.market);
    const indexPrice = book.indexPrice || pos.averagePrice;

    const unrealizedPnl =
      pos.side === "LONG"
        ? (indexPrice - pos.averagePrice) * pos.qty
        : (pos.averagePrice - indexPrice) * pos.qty;

    return { ...pos, unrealizedPnl, indexPrice };
  });

  return { correlationId: request.correlationId, ok: true, data: result };
}

import type {
  EngineRequest,
  EngineResponse,
  GetOrderbookPayload,
} from "@perps-xt/types";
import { getOrCreateOrderbook } from "../store";
import { serializeOrderbook } from "../matching/orderbook";

export function handleGetOrderbook(request: EngineRequest): EngineResponse {
  const payload = request.payload as unknown as GetOrderbookPayload;

  if (!payload.market) {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Market required",
    };
  }

  const book = getOrCreateOrderbook(payload.market);
  const depth = serializeOrderbook(book, payload.market);

  return {
    correlationId: request.correlationId,
    ok: true,
    data: depth,
  };
}

import type {
  EngineRequest,
  EngineResponse,
  OnrampPayload,
} from "@perps-xt/types";
import { getOrCreateBalance } from "../store";

export function handleOnramp(request: EngineRequest): EngineResponse {
  const payload = request.payload as unknown as OnrampPayload;

  if (!payload.amount || payload.amount <= 0) {
    return {
      correlationId: request.correlationId,
      ok: false,
      error: "Invalid amount",
    };
  }

  const balance = getOrCreateBalance(request.userId);
  balance.available += payload.amount;

  return {
    correlationId: request.correlationId,
    ok: true,
    data: { available: balance.available, locked: balance.locked },
  };
}

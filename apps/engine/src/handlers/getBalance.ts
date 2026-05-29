import type { EngineRequest, EngineResponse } from "@perps-xt/types";
import { getOrCreateBalance } from "../store";

export function handleGetBalance(request: EngineRequest): EngineResponse {
  const balance = getOrCreateBalance(request.userId);
  return {
    correlationId: request.correlationId,
    ok: true,
    data: { available: balance.available, locked: balance.locked },
  };
}

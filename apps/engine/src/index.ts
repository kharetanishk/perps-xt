// apps/engine/src/index.ts
// The engine's main loop. One process, one thread, one stream.
// Reads from Redis stream sequentially — no race conditions possible.

import { createRedisClient, brpop, lpush, QUEUES } from "@perps-xt/redis";
import type { EngineRequest } from "@perps-xt/types";
import { handleCreateOrder } from "./handlers/createOrder";

const client = createRedisClient();

console.log("[engine] starting...");

async function main() {
  while (true) {
    try {
      // block until a message arrives — zero CPU while waiting
      const request = await brpop<EngineRequest>(
        client,
        QUEUES.ENGINE_REQUESTS,
      );

      if (!request) continue; // timeout hit (shouldn't happen with timeout=0)

      // route to correct handler based on message type
      let response;

      switch (request.type) {
        case "create_order":
          response = handleCreateOrder(request);
          break;

        default:
          response = {
            correlationId: request.correlationId,
            ok: false,
            error: `Unknown request type: ${request.type}`,
          };
      }

      // send response back to the API server's private queue
      await lpush(client, request.responseQueue, response);
    } catch (err) {
      // log but never crash — engine must keep running
      console.error("[engine] error processing message:", err);
    }
  }
}

main();

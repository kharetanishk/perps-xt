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
          response = handleCreateOrder(request, client);
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

import { orderbooks, balances, positions } from "./store";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

function saveSnapshot() {
  const snapshot = {
    timestamp: Date.now(),
    orderbooks: Object.fromEntries(
      Array.from(orderbooks.entries()).map(([market, book]) => [
        market,
        {
          // convert Maps to plain objects for JSON serialization
          bids: Object.fromEntries(book.bids),
          asks: Object.fromEntries(book.asks),
          sortedBidPrices: book.sortedBidPrices,
          sortedAskPrices: book.sortedAskPrices,
          lastTradedPrice: book.lastTradedPrice,
          indexPrice: book.indexPrice,
        },
      ]),
    ),
    balances: Object.fromEntries(balances),
    positions: Object.fromEntries(
      Array.from(positions.entries()).map(([userId, userPos]) => [
        userId,
        Object.fromEntries(userPos),
      ]),
    ),
  };

  const dir = join(process.cwd(), "snapshots");
  const filename = `snapshot_${Date.now()}.json`;

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(snapshot));

  console.log(`[engine] snapshot saved: ${filename}`);
}

// save snapshot every 5 minutes
setInterval(saveSnapshot, 5 * 60 * 1000);

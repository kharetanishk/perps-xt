import { createRedisClient, brpop, lpush, QUEUES } from "@perps-xt/redis";
import { orderbooks, balances, positions } from "./store";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { EngineRequest } from "@perps-xt/types";
import { handleCreateOrder } from "./handlers/createOrder";
import { handleCancelOrder } from "./handlers/cancelOrder";
import { handleOnramp } from "./handlers/onramp";
import { handleGetBalance } from "./handlers/getBalance";
import { handleGetOrderbook } from "./handlers/getOrderbook";
import { handleGetPositions } from "./handlers/getPositions";
import { handleGetOpenOrders } from "./handlers/getOpenOrders";

const client = createRedisClient();
console.log("[engine] starting...");

async function main() {
  while (true) {
    try {
      const request = await brpop<EngineRequest>(
        client,
        QUEUES.ENGINE_REQUESTS,
      );
      if (!request) continue;

      let response;

      switch (request.type) {
        case "create_order":
          response = await handleCreateOrder(request, client);
          break;
        case "cancel_order":
          response = handleCancelOrder(request);
          break;
        case "onramp":
          response = handleOnramp(request);
          break;
        case "get_balance":
          response = handleGetBalance(request);
          break;
        case "get_orderbook":
          response = handleGetOrderbook(request);
          break;
        case "get_positions":
          response = handleGetPositions(request);
          break;
        case "get_open_orders":
          response = handleGetOpenOrders(request);
          break;
        default:
          response = {
            correlationId: request.correlationId,
            ok: false,
            error: `Unknown: ${request.type}`,
          };
      }

      await lpush(client, request.responseQueue, response);
    } catch (err) {
      console.error("[engine] error:", err);
    }
  }
}

function saveSnapshot() {
  const snapshot = {
    timestamp: Date.now(),
    orderbooks: Object.fromEntries(
      Array.from(orderbooks.entries()).map(([market, book]) => [
        market,
        {
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
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `snapshot_${Date.now()}.json`),
    JSON.stringify(snapshot),
  );
  console.log("[engine] snapshot saved");
}

setInterval(saveSnapshot, 5 * 60 * 1000);
main();

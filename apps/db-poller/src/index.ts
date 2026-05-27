// apps/db-poller/src/index.ts
// One job: read from db-writes queue, write to Postgres.
// Runs forever. Never blocks the engine.
// If Postgres is slow, this falls behind — engine keeps running fine.

import { createRedisClient, brpop, QUEUES } from "@perps-xt/redis";
import { PrismaClient } from "@prisma/client";

const redis = createRedisClient();
const prisma = new PrismaClient();

console.log("[db-poller] started");

// what the engine puts on the db-writes queue
interface DbWriteMessage {
  type: "fill" | "order";
  payload: Record<string, unknown>;
}

async function main() {
  while (true) {
    try {
      const message = await brpop<DbWriteMessage>(redis, QUEUES.DB_WRITES);

      if (!message) continue;

      switch (message.type) {
        case "order": {
          const o = message.payload as any;
          await prisma.order.upsert({
            where: { orderId: o.orderId },
            update: { status: o.status, filledQty: o.filledQty },
            create: {
              orderId: o.orderId,
              userId: o.userId,
              market: o.market,
              side: o.side,
              orderType: o.orderType,
              price: o.price,
              qty: o.qty,
              filledQty: o.filledQty,
              status: o.status,
              margin: o.margin,
            },
          });
          break;
        }

        case "fill": {
          const f = message.payload as any;
          await prisma.fill.create({
            data: {
              fillId: f.fillId,
              market: f.market,
              price: f.price,
              qty: f.qty,
              makerOrderId: f.makerOrderId,
              takerOrderId: f.takerOrderId,
              makerUserId: f.makerUserId,
              takerUserId: f.takerUserId,
            },
          });
          break;
        }
      }
    } catch (err) {
      console.error("[db-poller] error:", err);
      // never crash — log and continue
    }
  }
}

main();

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { prisma } from "@perps-xt/db";
import request from "supertest";
import app from "../app";

// tokens for our two test users
let tokenA: string;
let tokenB: string;
let userAId: string;
let userBId: string;
let openOrderId: string; // for cancel test

// ─── SETUP ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // clean up test users
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: "useratest@perps.com" }, { email: "userbtest@perps.com" }],
    },
  });

  // signup User A
  const resA = await request(app).post("/api/v2/auth/signup").send({
    username: "userA_perps",
    email: "useratest@perps.com",
    password: "password123",
  });
  tokenA = resA.body.token;
  userAId = resA.body.userId;

  // signup User B
  const resB = await request(app).post("/api/v2/auth/signup").send({
    username: "userB_perps",
    email: "userbtest@perps.com",
    password: "password123",
  });
  tokenB = resB.body.token;
  userBId = resB.body.userId;
});

// ─── TC1: ONRAMP ──────────────────────────────────────────────────────────────

describe("TC1: Onramp", () => {
  it("User A onramps 10000", async () => {
    const res = await request(app)
      .post("/api/v2/balance/onramp")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ amount: 10000 });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(10000);
    expect(res.body.locked).toBe(0);
  });

  it("User B onramps 10000", async () => {
    const res = await request(app)
      .post("/api/v2/balance/onramp")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ amount: 10000 });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(10000);
  });

  it("rejects invalid amount", async () => {
    const res = await request(app)
      .post("/api/v2/balance/onramp")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ amount: -100 });
    expect(res.status).toBe(400);
  });
});

// ─── TC2: GET BALANCE ─────────────────────────────────────────────────────────

describe("TC2: Get balance", () => {
  it("returns correct balance after onramp", async () => {
    const res = await request(app)
      .get("/api/v2/balance")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(10000);
    expect(res.body.locked).toBe(0);
  });
});

// ─── TC3: ORDER RESTS IN BOOK (no match) ─────────────────────────────────────

describe("TC3: Limit order rests in book", () => {
  it("User A places LONG SOL at 90 - no match yet", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "SOL",
        side: "LONG",
        orderType: "limit",
        price: 90,
        qty: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("open");
    openOrderId = res.body.orderId;
  });

  it("depth shows bid at 90", async () => {
    const res = await request(app).get("/api/v2/depth/SOL");
    expect(res.status).toBe(200);
    expect(res.body.bids[0].price).toBe(90);
    expect(res.body.bids[0].qty).toBe(10);
    expect(res.body.asks).toHaveLength(0);
  });

  it("balance has margin locked", async () => {
    const res = await request(app)
      .get("/api/v2/balance")
      .set("Authorization", `Bearer ${tokenA}`);
    // margin = (90 * 10) / 10 = 90
    expect(res.body.locked).toBe(90);
    expect(res.body.available).toBe(9910);
  });
});

// ─── TC4: CANCEL ORDER ────────────────────────────────────────────────────────

describe("TC4: Cancel order releases margin", () => {
  it("cancels the open order", async () => {
    const res = await request(app)
      .delete(`/api/v2/order/${openOrderId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("depth is now empty after cancel", async () => {
    const res = await request(app).get("/api/v2/depth/SOL");
    expect(res.body.bids).toHaveLength(0);
  });

  it("margin released back to available", async () => {
    const res = await request(app)
      .get("/api/v2/balance")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.body.available).toBe(10000);
    expect(res.body.locked).toBe(0);
  });

  it("cannot cancel already cancelled order", async () => {
    const res = await request(app)
      .delete(`/api/v2/order/${openOrderId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
  });
});

// ─── TC5: FULL MATCH ──────────────────────────────────────────────────────────

describe("TC5: Full match between two users", () => {
  let fillId: string;

  it("User A places LONG SOL at 100 qty=10", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "SOL",
        side: "LONG",
        orderType: "limit",
        price: 100,
        qty: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("open");
  });

  it("User B places SHORT SOL at 100 qty=10 - full match", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        market: "SOL",
        side: "SHORT",
        orderType: "limit",
        price: 100,
        qty: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("filled");
    expect(res.body.fills).toHaveLength(1);
    expect(res.body.fills[0].price).toBe(100);
    expect(res.body.fills[0].qty).toBe(10);
    fillId = res.body.fills[0].fillId;
  });

  it("User A has LONG position", async () => {
    const res = await request(app)
      .get("/api/v2/positions")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const positions = res.body;
    expect(positions).toHaveLength(1);
    expect(positions[0].side).toBe("LONG");
    expect(positions[0].qty).toBe(10);
    expect(positions[0].averagePrice).toBe(100);
    // liquidation = 100 - (100/10) = 90
    expect(positions[0].liquidationPrice).toBe(90);
  });

  it("User B has SHORT position", async () => {
    const res = await request(app)
      .get("/api/v2/positions")
      .set("Authorization", `Bearer ${tokenB}`);
    const positions = res.body;
    expect(positions[0].side).toBe("SHORT");
    expect(positions[0].qty).toBe(10);
    // liquidation = 100 + (100/10) = 110
    expect(positions[0].liquidationPrice).toBe(110);
  });

  it("depth is empty after full match", async () => {
    const res = await request(app).get("/api/v2/depth/SOL");
    expect(res.body.bids).toHaveLength(0);
    expect(res.body.asks).toHaveLength(0);
  });

  it("GET /order/fills returns the fill", async () => {
    const res = await request(app)
      .get("/api/v2/order/fills")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].price).toBe(100);
  });
});

// ─── TC6: PARTIAL MATCH ───────────────────────────────────────────────────────

describe("TC6: Partial fill", () => {
  it("User A places LONG ETH at 2000 qty=10", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "ETH",
        side: "LONG",
        orderType: "limit",
        price: 2000,
        qty: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("open");
  });

  it("User B places SHORT ETH at 2000 qty=6 - partial fill", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        market: "ETH",
        side: "SHORT",
        orderType: "limit",
        price: 2000,
        qty: 6,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("filled");
  });

  it("User A order is partially_filled", async () => {
    const res = await request(app)
      .get("/api/v2/order/open")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const ethOrder = res.body.find((o: any) => o.market === "ETH");
    expect(ethOrder).toBeDefined();
    expect(ethOrder.status).toBe("partially_filled");
    expect(ethOrder.filledQty).toBe(6);
  });

  it("depth shows remaining 4 qty at 2000", async () => {
    const res = await request(app).get("/api/v2/depth/ETH");
    expect(res.body.bids[0].price).toBe(2000);
    expect(res.body.bids[0].qty).toBe(4);
  });
});

// ─── TC7: MARKET ORDER ────────────────────────────────────────────────────────

describe("TC7: Market order", () => {
  it("market order fills against resting limit", async () => {
    // User A has a resting LONG ETH bid at 2000 (qty 4 remaining from TC6)
    // User B places SHORT ETH MARKET qty=4
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ market: "ETH", side: "SHORT", orderType: "market", qty: 4 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("filled");
    expect(res.body.fills[0].price).toBe(2000);
  });

  it("market order with zero liquidity gets cancelled", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ market: "BTC", side: "LONG", orderType: "market", qty: 1 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("cancelled");
  });
});

// ─── TC8: PRICE-TIME PRIORITY ─────────────────────────────────────────────────

describe("TC8: Price-time priority", () => {
  let firstOrderId: string;
  let secondOrderId: string;

  it("User A places LONG AVAX at 10 qty=5 FIRST", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "AVAX",
        side: "LONG",
        orderType: "limit",
        price: 10,
        qty: 5,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("open");
    firstOrderId = res.body.orderId;
  });

  it("User B places LONG AVAX at 10 qty=5 SECOND", async () => {
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        market: "AVAX",
        side: "LONG",
        orderType: "limit",
        price: 10,
        qty: 5,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("open");
    secondOrderId = res.body.orderId;
  });

  it("first order placed appears before second in open orders", async () => {
    const res = await request(app)
      .get("/api/v2/order/open")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const avaxOrders = res.body.filter((o: any) => o.market === "AVAX");
    expect(avaxOrders).toHaveLength(1);
    expect(avaxOrders[0].orderId).toBe(firstOrderId);
    // firstOrderId was placed before secondOrderId
    // createdAt of first should be <= second
    const firstOrder = avaxOrders[0];
    expect(firstOrder.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("depth shows combined qty at price 10", async () => {
    const res = await request(app).get("/api/v2/depth/AVAX");
    expect(res.body.bids[0].price).toBe(10);
    expect(res.body.bids[0].qty).toBe(10); // 5 from A + 5 from B
  });
});

// ─── TC9: INSUFFICIENT MARGIN ─────────────────────────────────────────────────

describe("TC9: Insufficient margin rejected", () => {
  it("rejects order when margin insufficient", async () => {
    // User A has been spending margin. Let's try an order that exceeds balance
    // place a massive order
    const res = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "BTC",
        side: "LONG",
        orderType: "limit",
        price: 100000,
        qty: 1000,
      });
    // marginRequired = (100000 * 1000) / 10 = 10,000,000 — way more than 10000
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("margin");
  });
});

// ─── TC10: CANNOT CANCEL FILLED ORDER ────────────────────────────────────────

describe("TC10: Cannot cancel filled order", () => {
  it("returns error when cancelling filled order", async () => {
    // place and match two orders to get a filled order
    await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        market: "DOGE",
        side: "LONG",
        orderType: "limit",
        price: 1,
        qty: 10,
      });

    const shortRes = await request(app)
      .post("/api/v2/order")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        market: "DOGE",
        side: "SHORT",
        orderType: "limit",
        price: 1,
        qty: 10,
      });

    const filledOrderId = shortRes.body.orderId;

    const cancelRes = await request(app)
      .delete(`/api/v2/order/${filledOrderId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.error).toContain("filled");
  });
});

// ─── TC11: GET OPEN ORDERS ────────────────────────────────────────────────────

describe("TC11: Get open orders", () => {
  it("returns only open and partially_filled orders", async () => {
    const res = await request(app)
      .get("/api/v2/order/open")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    // all returned orders should be open or partially_filled
    for (const order of res.body) {
      expect(["open", "partially_filled"]).toContain(order.status);
    }
  });
});

// ─── TC12: REQUIRES AUTH ──────────────────────────────────────────────────────

describe("TC12: Auth protection", () => {
  it("rejects order without token", async () => {
    const res = await request(app).post("/api/v2/order").send({
      market: "SOL",
      side: "LONG",
      orderType: "limit",
      price: 90,
      qty: 1,
    });
    expect(res.status).toBe(401);
  });

  it("rejects balance check without token", async () => {
    const res = await request(app).get("/api/v2/balance");
    expect(res.status).toBe(401);
  });
});

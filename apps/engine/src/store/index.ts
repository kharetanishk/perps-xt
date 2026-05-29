import { LiveOrderbook, OrderRecord, Balance, Position } from "@perps-xt/types";

//one orderbook per market
export const orderbooks = new Map<string, LiveOrderbook>();

//userid-> market -> positions
export const positions = new Map<string, Map<string, Position>>();
//userid -> balances
export const balances = new Map<string, Balance>();
//order history using orderId
export const orders = new Map<string, OrderRecord>();

//seed a user with some balance production mein onramp use krenge
export function getOrCreateBalance(userId: string): Balance {
  if (!balances.has(userId)) {
    balances.set(userId, { available: 0, locked: 0 });
  }
  return balances.get(userId)!;
}

// Get or create an orderbook for a market
// Called when the first order for a new market arrives
export function getOrCreateOrderbook(market: string): LiveOrderbook {
  if (!orderbooks.has(market)) {
    orderbooks.set(market, {
      bids: new Map(),
      asks: new Map(),
      sortedBidPrices: [],
      sortedAskPrices: [],
      lastTradedPrice: 0,
      indexPrice: 0,
    });
  }
  return orderbooks.get(market)!;
}

export function getOrCreateUserPositions(
  userId: string,
): Map<string, Position> {
  if (!positions.has(userId)) {
    positions.set(userId, new Map());
  }
  return positions.get(userId)!;
}

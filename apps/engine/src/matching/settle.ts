import { v4 as uuid } from "uuid";
import type { Fill, Position } from "@perps-xt/types";
import {
  positions,
  getOrCreateBalance,
  getOrCreateUserPositions,
} from "../store";

// main settlement function
// Called once per fill. Settles both the maker and the taker.

export function settleFill(fill: Fill, makerSide: "LONG" | "SHORT"): void {
  const takerSide = makerSide === "LONG" ? "SHORT" : "LONG";

  // settle both sides
  settleUserFill(
    fill.makerUserId,
    fill.market,
    makerSide,
    fill.price,
    fill.qty,
  );
  settleUserFill(
    fill.takerUserId,
    fill.market,
    takerSide,
    fill.price,
    fill.qty,
  );
}

// per user settlement

function settleUserFill(
  userId: string,
  market: string,
  side: "LONG" | "SHORT",
  fillPrice: number,
  fillQty: number,
): void {
  const userPositions = getOrCreateUserPositions(userId);
  const existing = userPositions.get(market);

  if (!existing) {
    // no existing position — open a new one
    openNewPosition(userId, market, side, fillPrice, fillQty, userPositions);
    return;
  }

  if (existing.side === side) {
    // same direction — adding to position (increasing exposure)
    increasePosition(existing, fillPrice, fillQty);
  } else {
    // opposite direction — reducing or closing or flipping position
    reduceOrClosePosition(
      userId,
      market,
      existing,
      fillPrice,
      fillQty,
      userPositions,
    );
  }
}

// open new positions

function openNewPosition(
  userId: string,
  market: string,
  side: "LONG" | "SHORT",
  price: number,
  qty: number,
  userPositions: Map<string, Position>,
): void {
  const margin = calculateMargin(price, qty);
  const liquidationPrice = calculateLiquidationPrice(side, price, margin, qty);

  const position: Position = {
    positionId: uuid(),
    userId,
    market,
    side,
    qty,
    averagePrice: price,
    margin,
    liquidationPrice,
    realizedPnl: 0,
    unrealizedPnl: 0, // calculated on read, not stored
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  userPositions.set(market, position);

  // lock margin in user's balance
  const balance = getOrCreateBalance(userId);
  balance.available -= margin;
  balance.locked += margin;
}

//increase position
// User adds to an existing position on the same side
// Average price is recalculated as weighted average

function increasePosition(
  position: Position,
  fillPrice: number,
  fillQty: number,
): void {
  const additionalMargin = calculateMargin(fillPrice, fillQty);

  // weighted average price
  // e.g. existing: 5 SOL at $90. adding: 5 SOL at $100
  // new average = (5×90 + 5×100) / 10 = $95
  const totalQty = position.qty + fillQty;
  const newAveragePrice =
    (position.qty * position.averagePrice + fillQty * fillPrice) / totalQty;

  position.qty = totalQty;
  position.averagePrice = newAveragePrice;
  position.margin += additionalMargin;
  position.liquidationPrice = calculateLiquidationPrice(
    position.side,
    newAveragePrice,
    position.margin,
    totalQty,
  );
  position.updatedAt = Date.now();

  // lock additional margin
  const balance = getOrCreateBalance(position.userId);
  balance.available -= additionalMargin;
  balance.locked += additionalMargin;
}

// reduce /close/flip position
// User trades opposite to their existing position
// Three sub-cases: partial close, full close, flip

function reduceOrClosePosition(
  userId: string,
  market: string,
  position: Position,
  fillPrice: number,
  fillQty: number,
  userPositions: Map<string, Position>,
): void {
  if (fillQty < position.qty) {
    // partially close
    // Closing part of the position. Realize PnL on the closed portion.
    const closedRatio = fillQty / position.qty;
    const releasedMargin = position.margin * closedRatio;
    const realizedPnl = calculateRealizedPnl(
      position.side,
      position.averagePrice,
      fillPrice,
      fillQty,
    );

    position.qty -= fillQty;
    position.margin -= releasedMargin;
    position.realizedPnl += realizedPnl;
    position.updatedAt = Date.now();

    // release proportional margin back to available
    const balance = getOrCreateBalance(userId);
    balance.locked -= releasedMargin;
    balance.available += releasedMargin + realizedPnl;
    // profit adds to available, loss subtracts from it
  } else if (fillQty === position.qty) {
    // full close
    const realizedPnl = calculateRealizedPnl(
      position.side,
      position.averagePrice,
      fillPrice,
      fillQty,
    );

    // release all margin
    const balance = getOrCreateBalance(userId);
    balance.locked -= position.margin;
    balance.available += position.margin + realizedPnl;

    userPositions.delete(market); // position gone
  } else {
    // flip
    // fillQty > position.qty
    // Close the existing position fully, open new one on opposite side
    const closeQty = position.qty;
    const newQty = fillQty - closeQty;
    const newSide = position.side === "LONG" ? "SHORT" : "LONG";

    // first fully close existing
    const realizedPnl = calculateRealizedPnl(
      position.side,
      position.averagePrice,
      fillPrice,
      closeQty,
    );

    const balance = getOrCreateBalance(userId);
    balance.locked -= position.margin;
    balance.available += position.margin + realizedPnl;

    userPositions.delete(market);

    // then open new position on opposite side with remaining qty
    openNewPosition(userId, market, newSide, fillPrice, newQty, userPositions);
  }
}

// finance formulas

// Margin = notional value / leverage
// For v1: fixed 10x leverage (10% margin rate)
// In production: leverage comes from the order
const LEVERAGE = 10;

function calculateMargin(price: number, qty: number): number {
  return (price * qty) / LEVERAGE;
}

// Liquidation price = the price at which margin is fully consumed
// LONG:  liquidationPrice = averagePrice - (margin / qty)
//        if price drops this much, you've lost all your margin
// SHORT: liquidationPrice = averagePrice + (margin / qty)
//        if price rises this much, you've lost all your margin
function calculateLiquidationPrice(
  side: "LONG" | "SHORT",
  averagePrice: number,
  margin: number,
  qty: number,
): number {
  const marginPerUnit = margin / qty;

  return side === "LONG"
    ? averagePrice - marginPerUnit // LONG liquidates below entry
    : averagePrice + marginPerUnit; // SHORT liquidates above entry
}

// Realized PnL = profit/loss on the closed portion
// LONG:  pnl = (exitPrice - entryPrice) × qty
// SHORT: pnl = (entryPrice - exitPrice) × qty
function calculateRealizedPnl(
  side: "LONG" | "SHORT",
  entryPrice: number,
  exitPrice: number,
  qty: number,
): number {
  return side === "LONG"
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
}

// ─── LIQUIDATION CHECK ────────────────────────────────────────────────────────
// Called by engine on every price tick for a market
// Returns userIds of liquidated users so engine can create liquidation fills

export function checkLiquidations(
  market: string,
  indexPrice: number,
): string[] {
  const liquidated: string[] = [];

  for (const [userId, userPositions] of positions) {
    const position = userPositions.get(market);
    if (!position) continue;

    const isLiquidated =
      position.side === "LONG"
        ? indexPrice <= position.liquidationPrice // price fell too low
        : indexPrice >= position.liquidationPrice; // price rose too high

    if (isLiquidated) {
      liquidated.push(userId);
      // force close — realize full loss
      const balance = getOrCreateBalance(userId);
      balance.locked -= position.margin;
      // margin is gone — absorbed by the insurance fund
      // in v1: just remove it. in production: goes to insurance fund
      userPositions.delete(market);
    }
  }

  return liquidated;
}

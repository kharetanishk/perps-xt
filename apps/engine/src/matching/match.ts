import { v4 as uuid } from "uuid";
import type {
  OrderRecord,
  RestingOrder,
  Fill,
  LiveOrderbook,
} from "@perps-xt/types";
import { addOrderToBook } from "./orderbook";

export interface MatchResult {
  fills: Fill[];
  order: OrderRecord;
}

export function matchOrder(
  order: OrderRecord,
  book: LiveOrderbook,
): MatchResult {
  const fills: Fill[] = [];
  let remainingQty = order.qty; //its the qty that the user has ordered

  const isLong = order.side === "LONG";

  const priceMap = isLong ? book.asks : book.bids;
  const sortedPrices = isLong ? book.sortedAskPrices : book.sortedBidPrices;

  //matching loop :)
  while (remainingQty > 0 && sortedPrices.length > 0) {
    const bestPrice = sortedPrices[0]!;

    //now canMatch is only possible in these conditions ....
    //if market order then match to hoga hi (true) and if linmit order
    //long -> order.price >= best price / short -> order.price  <= best price
    const canMatch =
      order.orderType === "market"
        ? true
        : isLong
          ? order.price! >= bestPrice
          : order.price! <= bestPrice;

    //agr match nahi hua to break
    if (!canMatch) break;

    //orders nikalo -> resting orders - lvel
    const level = priceMap.get(bestPrice)!;
    let i = 0;

    while (i < level.length && remainingQty > 0) {
      const resting = level[i]!;
      const restingRemaining = resting.qty - resting.filledQty;
      const fillQty = Math.min(remainingQty, restingRemaining);

      const fill: Fill = {
        fillId: uuid(),
        market: order.market,
        price: bestPrice, // always maker's price
        qty: fillQty,
        makerOrderId: resting.orderId,
        takerOrderId: order.orderId,
        makerUserId: resting.userId,
        takerUserId: order.userId,
        timestamp: Date.now(),
      };

      fills.push(fill);

      resting.filledQty += fillQty;
      order.filledQty += fillQty;
      remainingQty -= fillQty;

      if (resting.filledQty === resting.qty) {
        level.splice(i, 1); // fully filled — remove, don't increment i
      } else {
        i++; // partially filled — stays in book
      }
    }

    if (level.length === 0) {
      priceMap.delete(bestPrice);
      sortedPrices.shift();
    }
  }

  //final status after matching ....
  if (remainingQty === 0) {
    order.status = "filled";
  } else if (order.filledQty > 0) {
    // some filled, some remaining
    order.status = "partially_filled";
    if (order.orderType === "limit") {
      addOrderToBook(book, toRestingOrder(order, remainingQty));
    }
  } else {
    // nothing matched at all
    if (order.orderType === "limit") {
      order.status = "open";
      addOrderToBook(book, toRestingOrder(order, remainingQty));
    } else {
      order.status = "cancelled"; // market order, zero liquidity
    }
  }

  //lasttradedprice -> price of most recent trade of our exchange
  if (fills.length > 0) {
    book.lastTradedPrice = fills[fills.length - 1]!.price;
  }

  return { fills, order };
}

//this fn It takes the remaining unfilled
//portion and creates a clean resting order from it.
function toRestingOrder(
  order: OrderRecord,
  remainingQty: number,
): RestingOrder {
  return {
    orderId: order.orderId,
    userId: order.userId,
    market: order.market,
    side: order.side,
    price: order.price!,
    qty: remainingQty,
    filledQty: 0,
    // proportional margin: if 3 of 10 qty remaining, lock 30% of original margin
    margin: order.margin * (remainingQty / order.qty),
    createdAt: order.createdAt,
  };
}

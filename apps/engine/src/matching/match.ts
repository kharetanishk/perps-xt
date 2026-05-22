import { v4 as uuid } from "uuid";
import {
  RestingOrder,
  OrderRecord,
  Fill,
  LiveOrderbook,
} from "@perps-xt/types";

import { addOrderToBook } from "./orderbook";

export interface MatchResult {
  fill: Fill[];
  order: OrderRecord;
}

export function matchOrder(
  order: OrderRecord,
  book: LiveOrderbook,
): MatchResult {
  //right now nothing is into fills as no order matched yet
  const fills: Fill[] = [];
  let remainingQty = order.qty; //itna qty order kiya hai ,jo abhi tk match nahi hua hai

  const isLong = order.side === "Long";

  //agr long k order hai to ask ke order se map krenge and vice versa
  const priceMap = isLong ? book.asks : book.bids;
  const sortedPrices = isLong ? book.sortedAskPrices : book.sortedBidPrices;

  //jtbk remaningQty (the qty you ordered for ) 0 na ho jaye (fulfill na hojye)
  //tbtk yehloop ko chalate rho and sortedpirce.length is like agr bid k hai to ask
  //mein kuch prices toh  hona chaioye na vhi bol rh bsdk
  while (remainingQty > 0 && sortedPrices.length > 0) {
    //as we have already sortedthearray so its first index will be the best price
    const bestPrice = sortedPrices[0]!;

    // yeh check krta hai ki agr market order hai to hmesha true rhega
    //nahi to vo limit order hoga
    const canMatch =
      order.orderType === "market"
        ? true
        : isLong
          ? order.price! >= bestPrice // buyer willing to pay at least bestPrice
          : order.price! <= bestPrice; // seller willing to accept at most bestPrice

    if (!canMatch) break;

    //get the orders corresponding to bestprice
    const level = priceMap.get(bestPrice)!;

    //iterate through order at this price levle
    let i = 0;

    //yeh while looop fills ko bharta hai for a particular order
    //jabtk orders k length  bda hai i se  and remaining qty -> qty jo mein order krunga
    while (i < level.length && remainingQty > 0) {
      //go through each orders for a particular price lvl
      const resting = level[i];
      //calculate how much qty remainig to be filled for that order
      //if like orderA -> qty : 5 and filledQty: 3 then remiainingwill be 2
      const restingRemaining = resting?.qty - resting?.filledQty;
      //filledQty -> this much qty can be get filled here (8,2)=> 2
      const fillQty = Math.min(remainingQty, restingRemaining);

      //create the fill for orderA
      const fill: Fill = {
        fillId: uuid(),
        market: order.market,
        price: bestPrice,
        qty: fillQty,
        makerOrderId: resting.orderId,
        takerOrderId: order.orderId,
        makerUserId: resting.userId,
        takerUserId: order.userId,
        timestamp: Date.now(),
      };

      //push the fill in the fills array
      fills.push(fill);

      resting?.filledQty += fillQty;
      order.filledQty += fillQty;
      remainingQty -= fillQty;

      //means if for a resting order , the qty get  fully consumed
      //then remove that order
      if (resting?.filledQty === resting?.qty) {
        level.splice(i, 1);
        //dont increment i -next order slides into i position
      } else {
        //this increment happen when the very first has surplus remaining filled qty
        //and it satisfies the remaningqty of the user order , so thus remainingqty get 0
        //and even when the i got incrementd the outer loop stopped ,as the condition of the loop
        //got fulfilled to get stopped
        i++;
      }
    }

    if (level.length === 0) {
      priceMap.delete(bestPrice);
      sortedPrices.shift(); //removes from the front
    }
  } //yha matching loop end hogya now we need to update the statuses

  if (remainingQty === 0) {
    order.status === "filled";
  } else if (remainingQty > 0) {
    order.status === "partially_filled";
    if (order.orderType === "limit") {
      addOrderToBook(book, toRestingOrder(order, remainingQty));
    }
    //market order got consumed , the rest is gone
  } else {
    //if nothing matched , then it will definitely rest in the order book
    if (order.orderType === "limit") {
      order.status = "open";
      addOrderToBook(book, toRestingOrder(order, remainingQty));
    } else {
      order.status = "cancelled"; //market order in 0 liquidity
    }
  }
  if (fills.length > 0) {
    book.lastTradedPrice = fills[fills.length - 1].price;
  }

  return { fills, order };
}

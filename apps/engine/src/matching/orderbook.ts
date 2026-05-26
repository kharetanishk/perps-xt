import type { LiveOrderbook, RestingOrder } from "@perps-xt/types";

function findInsertIndex(
  sortedPrices: number[],
  price: number,
  descending: boolean,
): number {
  let low = 0;
  let high = sortedPrices.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const midPrice = sortedPrices[mid]!;

    if (descending) {
      if (midPrice > price) low = mid + 1;
      else high = mid;
    } else {
      if (midPrice < price) low = mid + 1;
      else high = mid;
    }
  }

  return low;
}

//addordertoook
export function addOrderToBook(book: LiveOrderbook, order: RestingOrder): void {
  const isBid = order.side === "LONG";
  const priceMap = isBid ? book.bids : book.asks;
  const sortedPrices = isBid ? book.sortedBidPrices : book.sortedAskPrices;

  //agr jo mein order de rha hu uska price already exist kr rha hai to as per the
  //price priority mera order sbse piche hoga already existing order se us particular price ke liye
  if (priceMap.has(order.price)) {
    priceMap.get(order.price)!.push(order);
    return;
  }

  //toh ab jo price mein humne bid kiya uska order exist nahi krta
  // so crate a new one
  priceMap.set(order.price, [order]);
  //ab  agr new price add horha to sortedprices ke array mein konse
  //position mein jyega yeh decide hum binary search ke through krengen
  const idx = findInsertIndex(sortedPrices, order.price, isBid);
  sortedPrices.splice(idx, 0, order.price);
}

export function removeOrderFromBook(
  book: LiveOrderbook,
  order: RestingOrder,
): void {
  const isBid = order.side === "LONG";
  const priceMap = isBid ? book.bids : book.asks;
  const sortedPrices = isBid ? book.sortedBidPrices : book.sortedAskPrices;

  //uss particular bid/ask ke liye koi order exist krta hai ya nahi
  //agr nahi krta toh phir order nahi hai (level kuch nahi h) toh
  //bc kya lund delete kroge , kuch mt krna just return
  const level = priceMap.get(order.price); // uss particular price ke liye kitne orders hai
  if (!level) return;

  //ab remaining orders tb niklege kese jo orderid hum dlt nahi
  //krna chah rha level se vo sb remaining orders ke array mein aajyenge
  const remaining = level.filter((o) => o.orderId !== order.orderId);

  if (remaining.length === 0) {
    //ab agr remaining orders nahi hai to us price level k hone k koi mltb nahi hai
    priceMap.delete(order.price);
    //and sortedprice ke array se bhi vo price hta do as ab vo price mein kuch bhi exist nahi krta hai
    const idx = sortedPrices.indexOf(order.price);
    if (idx !== -1) sortedPrices.splice(idx, 1);
  } else {
    //like before 105 -> [order1 , order2]
    //tumne level se filter kiya remainorder ko , to jitne filter hogye soo hogye pr jo bache
    //usko uss pricemap mein vpis bhi to set krna hai
    //after 105 -> [order 1]
    priceMap.set(order.price, remaining);
  }
}

//get best price

export function getBestBid(book: LiveOrderbook): number | null | undefined {
  return book.sortedBidPrices.length > 0 ? book.sortedBidPrices[0] : null;
}

export function getBestAsk(book: LiveOrderbook): number | null | undefined {
  return book.sortedAskPrices.length > 0 ? book.sortedAskPrices[0] : null;
}

// Map cannot be JSON serialized — this is the conversion step Serialization
export function serializeOrderbook(
  book: LiveOrderbook,
  market: string,
  depth = 20,
) {
  const bids = book.sortedBidPrices.slice(0, depth).map((price) => ({
    price,
    qty: book.bids
      .get(price)!
      .reduce((sum, o) => sum + (o.qty - o.filledQty), 0),
  }));

  const asks = book.sortedAskPrices.slice(0, depth).map((price) => ({
    price,
    qty: book.asks
      .get(price)!
      .reduce((sum, o) => sum + (o.qty - o.filledQty), 0),
  }));

  return {
    market,
    bids,
    asks,
    lastTradedPrice: book.lastTradedPrice,
    indexPrice: book.indexPrice,
  };
}

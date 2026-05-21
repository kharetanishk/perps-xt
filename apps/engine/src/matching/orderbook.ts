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
    const midPrice = sortedPrices[mid];

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

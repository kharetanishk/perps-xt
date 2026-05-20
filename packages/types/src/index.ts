export type Side = "Long" | "Short";

export type OrderType = "limit" | "market";

export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

export interface User {
  userId: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

export interface Balance {
  available: number; //free to open new positions
  locked: number; //committed to open positions (exisiting ones)
}

/* yeh vo order hai jo order book mein rhenge */
export interface RestingOrder {
  orderId: string;
  userId: string;
  market: string;
  side: Side;
  price: number;
  qty: number;
  filledQty: number;
  margin: number;
  createdAt: number;
}

/* yeh rehega poora kaccha chitta ki user ne
kyh kya order kiya hai */
export interface OrderRecord {
  orderId: string;
  userId: string;
  market: string;
  side: Side;
  orderType: OrderType;
  price: number | null; // null qki agr market order dalega to
  qty: number;
  status: OrderStatus;
  margin: number;
  filledQty: number;
  fills: Fill[];
  createdAt: number;
}

// yeh tb create hota jb kuch fillhota (order match hota tb) orderbook-> position
//ya phir agar qty :0 ho jti tb close ho jta
export interface Position {
  positionId: string;
  userId: string;
  market: string;
  side: Side;
  qty: number;
  averagePrice: number; // weighted avg entry price across all fills
  margin: number; // total collateral locked for this position
  liquidationPrice: number; // engine force-closes if indexPrice hits this
  realizedPnl: number; // profit/loss from partially closed portions — stored
  unrealizedPnl: number; // (currentPrice - avgPrice) × qty — calculated on read
  createdAt: number;
  updatedAt: number;
}

export interface Fill {
  fillId: string;
  market: string;
  price: number; // the price at which the match happened
  qty: number; // how much was traded in this fill
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  timestamp: number;
}

export interface PriceLevel {
  price: number;
  qty: number; // total qty available at this price across all orders
}

// What we send to the client / WS subscribers — clean, serializable
export interface OrderbookDepth {
  market: string;
  bids: PriceLevel[]; // sorted highest price first
  asks: PriceLevel[]; // sorted lowest price first
  lastTradedPrice: number;
  indexPrice: number;
}

// The engine's in-memory orderbook — optimized for matching speed
// Map gives O(1) access by price. Sorted arrays give O(1) best price lookup.
// This is NOT serialized — it's an internal engine data structure
export interface LiveOrderbook {
  bids: Map<number, RestingOrder[]>; // price → orders at that price, oldest first
  asks: Map<number, RestingOrder[]>;
  sortedBidPrices: number[]; // descending: [100, 99, 98 ...]
  sortedAskPrices: number[]; // ascending:  [101, 102, 103 ...]
  lastTradedPrice: number;
  indexPrice: number;
}

export type EngineRequestType =
  | "create_order"
  | "cancel_order"
  | "get_orderbook" // engine memory → api (real-time depth)
  | "get_open_orders" // engine memory → api (user's resting orders)
  | "get_positions" // engine memory → api (user's open positions)
  | "get_balance"; // engine memory → api (user's collateral)

export interface EngineRequest {
  correlationId: string; // uuid, used to match response to pending HTTP request
  responseQueue: string; // "resp-queue-{apiInstanceId}" — api's private reply box
  type: EngineRequestType;
  userId: string;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  data?: unknown; // typed by the caller after receiving
  error?: string;
}

export interface CreateOrderPayload {
  market: string;
  side: Side;
  orderType: OrderType;
  price: number | null; // null for market orders
  qty: number;
  leverage: number; // e.g. 10 = 10x leverage
}

export interface CancelOrderPayload {
  orderId: string;
}

export interface GetOrderbookPayload {
  market: string;
}

export interface PriceTick {
  market: string;
  indexPrice: number;
  markPrice: number; // for v1 same as indexPrice, later add EMA smoothing
  timestamp: number;
}
export type WsEventType =
  | "price_update"
  | "orderbook_update"
  | "fill"
  | "position_update"
  | "order_update";

export interface WsEvent {
  type: WsEventType;
  market: string;
  data: unknown;
}

// // packages/types/src/index.ts
// // This is the single source of truth for every data shape in perps-xt.
// // Every service imports from here. Change here = TypeScript catches it everywhere.

// // ─── PRIMITIVES ───────────────────────────────────────────────────────────────

// // LONG = bet price goes UP, profit when market rises
// // SHORT = bet price goes DOWN, profit when market falls
// // These are NOT "buy" and "sell" — we never own the asset
// export type Side = "LONG" | "SHORT"

// export type OrderType = "limit" | "market"

// export type OrderStatus =
//   | "open"
//   | "partially_filled"
//   | "filled"
//   | "cancelled"

// // ─── USER ─────────────────────────────────────────────────────────────────────

// export interface User {
//   userId: string
//   username: string
//   passwordHash: string
//   createdAt: number
// }

// // ─── BALANCE ──────────────────────────────────────────────────────────────────

// // On a perp exchange, there is only ONE asset: USDT (collateral)
// // No multi-asset balances like spot. You deposit USDT, trade with USDT.
// export interface Balance {
//   available: number  // free to open new positions
//   locked: number     // committed to open positions / open orders
// }

// // ─── ORDERS ───────────────────────────────────────────────────────────────────

// // RestingOrder = a limit order sitting in the orderbook waiting to be matched
// // Market orders NEVER rest — they match immediately or fail
// // By having a separate type, the matching engine never has to null-check price
// export interface RestingOrder {
//   orderId: string
//   userId: string
//   market: string
//   side: Side
//   price: number       // always defined — resting orders always have a price
//   qty: number
//   filledQty: number
//   margin: number      // collateral locked for this order
//   createdAt: number
// }

// // OrderRecord = the full historical record of any order (limit or market)
// // This is what gets stored in Postgres and returned to the user
// export interface OrderRecord {
//   orderId: string
//   userId: string
//   market: string
//   side: Side
//   orderType: OrderType
//   price: number | null  // null for market orders — they have no fixed price
//   qty: number
//   filledQty: number
//   status: OrderStatus
//   margin: number
//   fills: Fill[]         // which fills came from this order
//   createdAt: number
// }

// // ─── POSITIONS ────────────────────────────────────────────────────────────────

// // A position = your current exposure to a market
// // Created/updated when fills happen, closed when qty reaches 0
// export interface Position {
//   positionId: string
//   userId: string
//   market: string
//   side: Side
//   qty: number
//   averagePrice: number      // weighted avg entry price across all fills
//   margin: number            // total collateral locked for this position
//   liquidationPrice: number  // engine force-closes if indexPrice hits this
//   realizedPnl: number       // profit/loss from partially closed portions — stored
//   unrealizedPnl: number     // (currentPrice - avgPrice) × qty — calculated on read
//   createdAt: number
//   updatedAt: number
// }

// // ─── FILLS ────────────────────────────────────────────────────────────────────

// // A fill = one completed match between two orders
// // Maker = the order that was already in the book (provided liquidity)
// // Taker = the order that came in and matched (took liquidity)
// // On real exchanges, takers pay higher fees than makers
// export interface Fill {
//   fillId: string
//   market: string
//   price: number          // the price at which the match happened
//   qty: number            // how much was traded in this fill
//   makerOrderId: string
//   takerOrderId: string
//   makerUserId: string
//   takerUserId: string
//   timestamp: number
// }

// // ─── ORDERBOOK ────────────────────────────────────────────────────────────────

// // PriceLevel = a summary of all orders at one specific price
// // Used in API responses and WS broadcasts — serializable to JSON
// export interface PriceLevel {
//   price: number
//   qty: number  // total qty available at this price across all orders
// }

// // What we send to the client / WS subscribers — clean, serializable
// export interface OrderbookDepth {
//   market: string
//   bids: PriceLevel[]   // sorted highest price first
//   asks: PriceLevel[]   // sorted lowest price first
//   lastTradedPrice: number
//   indexPrice: number
// }

// // The engine's in-memory orderbook — optimized for matching speed
// // Map gives O(1) access by price. Sorted arrays give O(1) best price lookup.
// // This is NOT serialized — it's an internal engine data structure
// export interface LiveOrderbook {
//   bids: Map<number, RestingOrder[]>  // price → orders at that price, oldest first
//   asks: Map<number, RestingOrder[]>
//   sortedBidPrices: number[]          // descending: [100, 99, 98 ...]
//   sortedAskPrices: number[]          // ascending:  [101, 102, 103 ...]
//   lastTradedPrice: number
//   indexPrice: number
// }

// // ─── REDIS MESSAGE CONTRACTS ──────────────────────────────────────────────────

// // Every message flowing through the system has a strict type
// // This prevents the engine from receiving malformed requests

// export type EngineRequestType =
//   | "create_order"
//   | "cancel_order"
//   | "get_orderbook"   // engine memory → api (real-time depth)
//   | "get_open_orders" // engine memory → api (user's resting orders)
//   | "get_positions"   // engine memory → api (user's open positions)
//   | "get_balance"     // engine memory → api (user's collateral)

// // api → engine (via backend-to-engine-broker queue)
// export interface EngineRequest {
//   correlationId: string   // uuid, used to match response to pending HTTP request
//   responseQueue: string   // "resp-queue-{apiInstanceId}" — api's private reply box
//   type: EngineRequestType
//   userId: string
//   payload: Record<string, unknown>
// }

// // engine → api (via per-instance response queue)
// export interface EngineResponse {
//   correlationId: string
//   ok: boolean
//   data?: unknown   // typed by the caller after receiving
//   error?: string
// }

// // ─── SPECIFIC REQUEST PAYLOADS ────────────────────────────────────────────────

// export interface CreateOrderPayload {
//   market: string
//   side: Side
//   orderType: OrderType
//   price: number | null  // null for market orders
//   qty: number
//   leverage: number      // e.g. 10 = 10x leverage
// }

// export interface CancelOrderPayload {
//   orderId: string
// }

// export interface GetOrderbookPayload {
//   market: string
// }

// // ─── PRICE TICK ───────────────────────────────────────────────────────────────

// // Published by indexer to Redis pub/sub every time Binance sends a price update
// // Consumed by: engine (liquidation checks) + WS server (push to clients)
// export interface PriceTick {
//   market: string
//   indexPrice: number
//   markPrice: number    // for v1 same as indexPrice, later add EMA smoothing
//   timestamp: number
// }

// // ─── WS EVENTS ────────────────────────────────────────────────────────────────

// // These are the shapes pushed to the client over WebSocket

// export type WsEventType =
//   | "price_update"
//   | "orderbook_update"
//   | "fill"
//   | "position_update"
//   | "order_update"

// export interface WsEvent {
//   type: WsEventType
//   market: string
//   data: unknown
// }

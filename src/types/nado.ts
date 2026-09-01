export type NadoEnv = 'testnet' | 'mainnet';

/**
 * Core EIP-712 Order struct used for placement
 */
export interface NadoOrder {
  sender: string; // Hex-encoded 32-byte subaccount identifier (address + padded name)
  priceX18: string; // Limit price * 1e18 as string
  amount: string; // Size * 1e18 as string (positive for BUY/LONG, negative for SELL/SHORT)
  expiration: string; // UNIX timestamp in seconds
  nonce: string; // Unique order nonce (timestamp in nanoseconds)
}

/**
 * REST Order Execution Payload
 */
export interface PlaceOrderPayload {
  place_order: {
    product_id: number;
    order: NadoOrder;
    signature: string;
  };
}

export interface WSStreamFilter {
  type: 'book_depth' | 'trade' | 'trades' | 'candlestick' | 'fill' | 'fills' | 'position_change' | 'order_update' | 'orders' | 'subaccount_info';
  product_id?: number;
  granularity?: number | string;
}

/**
 * WebSocket message requests
 */
export interface WSSubscriptionRequest {
  method: 'subscribe' | 'unsubscribe';
  stream: WSStreamFilter;
  id: number;
}

export interface WSAuthRequest {
  method: 'authenticate';
  id: number;
  tx: {
    sender: string;
    expiration: string | number;
  };
  signature: string;
}

export interface WSPingRequest {
  method: 'ping';
  id?: number;
}

export type WSClientRequest = WSSubscriptionRequest | WSAuthRequest | WSPingRequest;

/**
 * Public WebSocket feed data formats
 */
export interface WSBookDepthUpdate {
  product_id: number;
  bids: [string, string][]; // [priceX18, sizeX18]
  asks: [string, string][]; // [priceX18, sizeX18]
  timestamp: number; // UNIX timestamp (can be seconds or milliseconds)
}

export interface WSTradeUpdate {
  product_id: number;
  price: string; // priceX18
  amount: string; // amountX18 (positive = buy, negative = sell)
  timestamp: number;
  trade_id?: string;
}

export interface WSCandlestickUpdate {
  product_id: number;
  granularity: number | string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * Private WebSocket feed data formats
 */
export interface WSOrderUpdate {
  product_id: number;
  sender: string;
  priceX18: string;
  amount: string;
  expiration: string;
  nonce: string;
  signature: string;
  order_id: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
}

export interface WSFillUpdate {
  product_id: number;
  sender: string;
  order_id: string;
  fill_id: string;
  priceX18: string;
  amountX18: string; // positive/negative
  feeX18: string;
  timestamp: number;
}

export interface WSSubaccountInfoUpdate {
  sender: string;
  subaccount_name: string;
  collateralX18: string;
  free_collateralX18: string;
  margin_usageX18: string;
  timestamp: number;
}

export interface WSPositionChangeUpdate {
  product_id: number;
  sender: string;
  amount: string; // amountX18
  entry_price: string; // priceX18
  realized_pnl: string;
  unrealized_pnl: string;
  margin_usage: string;
  timestamp: number;
}

/**
 * REST / Archive API data formats
 */
export interface SubaccountPosition {
  product_id: number;
  amount: string; // float string or amountX18
  entry_price: string;
  unrealized_pnl: string;
}

export interface SubaccountState {
  sender: string;
  subaccount_name: string;
  collateral: string;
  free_collateral: string;
  margin_usage: string;
  positions: SubaccountPosition[];
}

export interface OHLCVBar {
  time: number; // UNIX timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PastFill {
  productId: number;
  orderId: string;
  fillId: string;
  price: number; // converted float
  amount: number; // converted float
  fee: number; // converted float
  timestamp: number; // seconds
  side: 'buy' | 'sell';
}

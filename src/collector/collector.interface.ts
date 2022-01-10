export interface EventKey {
  id: string;
}

export interface Event extends EventKey {
  timestamp: Date,
  address: String,
  event: String,
  amount: Number
  tokens: Number
  tokenName: String,
}

export interface SupplyKey {
  id: string;
}

export interface Supply extends SupplyKey {
  timestamp: Number,
  totalSupply: Number,
  token: String,
  event: String,
}
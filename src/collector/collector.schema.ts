import { Schema } from 'dynamoose';

export const EventSchema = new Schema({
  id: {
    // any unique id of your choice
    // i.e. address-timestamp
    type: String,
    hashKey: true,
  },
  timestamp: {
    // the timestamp of the current hour always normalized to
    // the start minute of each hour i.e. 08:00-08:59 = 08:00:00
    type: Date,
  },
  address: {
    // the address of the supply contract
    type: String,
    required: true,
    index: {
      global: true,
      rangeKey: 'timestamp',
    },
  },
  event: {
    type: String,
  },
  amount: {
    type: Number
  },
  tokens: {
    type: Number
  },
  tokenName: {
    type: String,
  }
});


export const SupplySchema = new Schema({
  id: {
    // any unique id of your choice
    // i.e. address-timestamp
    type: String,
    hashKey: true,
  },
  timestamp: {
    type: Number,
  },
  totalSupply: {
    type: Number,
  },
  token: { // Can be cETH, cDAI, and so on...
    type: String,
  },
  event: { // Can be Mint or Redeem
    type: String,
  }
});
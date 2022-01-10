# Thought process

As part of developing this challenge, I will be writing down my thought process and timelines.

## Analysis and Exploration

The main technologies for the challenge are:

* Infura, for reliably connecting to Ethereum networks
* Typescript and NestJS, for the underlying backend
* DynamoDB, for persisting
* GraphQL and Apollo, for querying TheGraph

Of these, I have only worked with Typescript, so some time was spent reading up on how to monitor smart contracts, setting up and playing with the Kovan network, using a faucet to get some KETH, understanding what role TheGraph fulfills in this challenge, and understanding what Compound does.

I have decided that I will focus on monitoring the ethereum compound token for this challenge, which can be found at https://etherscan.io/address/0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5#code. As a bonus, cDAI has been also added to the monitored smart contracts.

In the case of cETH (although a similar ABI exists for cDAI) the events I'm interested in are defined in the smart contract in lines 939 & 944:

```
/**
* @notice Event emitted when tokens are minted
*/
event Mint(address minter, uint mintAmount, uint mintTokens);

/**
* @notice Event emitted when tokens are redeemed
*/
event Redeem(address redeemer, uint redeemAmount, uint redeemTokens);
```

## Using Ethers.js

In order to monitor these events, we can use Ethers library, which is done on startup for the CollectorService. The simple event handler we register stores a simplified schema of the events into the local DynamoDB instance. Here's an example for Mint events:

```js
this.contractConnections.get(token).on("Mint", (minter, mintAmount, mintTokens, event) => {
    console.log(`Mint Happened - token: ${token}, minter: ${ minter }, mintAmount: ${ mintAmount }, mintTokens: ${ mintTokens}`);
    let eventToSave: Event = {
        address: minter,
        amount: Number(mintAmount),
        tokens: Number(mintTokens),
        timestamp: new Date(),
        event: 'Mint',
        id: ulid(),
        tokenName: token,
    }
    this.eventModel.create(eventToSave);
});
```

This is saved only as part of the bonus points, since no endpoint retrieves this data.

## Using TheGraph

Finally, as the underlying querying mechanism for the smart contract events, we use TheGraph as a service. The consumed GraphQL endpoint is [this one](https://thegraph.com/hosted-service/subgraph/graphprotocol/compound-v2?selected=playground).

As part of the client-side code to connect using GraphQL, we use apollo-client, since it's a fairly popular and well documented library.

To query Redeem and Mint events we define the following queries:

```
query MintEvents{
    mintEvents(where: {cTokenSymbol: "${symbol}", blockTime_gte: ${from}, blockTime_lt:${to}}) {
        id
        amount
        to
        from
        blockNumber
        blockTime
        cTokenSymbol
        underlyingAmount
    }
}

query RedeemEvents{
    redeemEvents(where: {cTokenSymbol: "${symbol}", blockTime_gte: ${from}, blockTime_lt:${to}}) {
      id
      amount
      to
      from
      blockNumber
      blockTime
      cTokenSymbol
      underlyingAmount
    }
}
```

These queries are ran, and the corresponding blockTime filters are updated to represent the beginning and end of yesterday (in UTC). Finally, there's a check in place to make sure we don't load the same rows twice: In case there's already data for last day locally, no new data is queried/saved.

```js
let result = await this.supplyModel.scan().filter('timestamp').between(beginning_day_before.unix() * 1000, beginning_today.unix() * 1000).count().exec();
    let isPreviousDayUnsaved = (result.count === 0); // if we find 0 records for yesterday, trigger download again
    if(isPreviousDayUnsaved){
        // .... rest of code
```

Finally, in case data is fetched, said data is transformed into the local schema by mapping, grouping by timestamp, and reducing all hourly buckets into the sum of amounts processed.

This leaves us with a neat schema:
```json
{
    "id": "01FS1C0H1F5RG69SM7652YN26B",
    "event": "Redeem",
    "totalSupply": 13918.03841379,
    "timestamp": 1641751200000,
    "token": "cETH"
}
```
Note that when `1641751200000` is transformed into a date, it yields `Sunday, January 9, 2022 6:00:00 PM`, representing the transactions for that hour.

## Controller and API Endpoint

Finally, we need a practical way of consuming this data, which is developed in `collector.controller.ts`, by exposing an API that reads like this:
```
GET /collector/lastday/:token/:event
```

Examples:
```
GET /collector/lastday/cDAI/Mint
GET /collector/lastday/cETH/Redeem
```

These requests will consume the data saved on the local database, remove unnecessary fields, and sort by timestamp in an ascending order.

## Example usage

The following request:
```
GET /collector/lastday/cDAI/Mint
```
Will return the following response:
```json
[
  {
    "timestamp": 1641686400000,
    "totalSupply": 2101.8723654299997
  },
  {
    "timestamp": 1641690000000,
    "totalSupply": 569.59936073
  },
  {
    "timestamp": 1641693600000,
    "totalSupply": 9165.101632509999
  },
  // ... ///
  {
    "timestamp": 1641758400000,
    "totalSupply": 657.6428951099999
  },
  {
    "timestamp": 1641762000000,
    "totalSupply": 6181.96553874
  },
  {
    "timestamp": 1641769200000,
    "totalSupply": 1146.65470114
  }
]

```

## TODOs

Several things were left out of this initial version due to the short time given for the assignment (3 days), and my inability to work full time on it, the known issues are:

* No unit testing
* `collector.service.ts` needs to have its interfaces normalized, and some code can be deduplicated (such as calculating the beginning and end of yesterday).
* No validation is done on the input for the written controller. 
* The functions which create the GraphQL queries are vulnerable to injection, which should be fixed by using a more standard parameter passing mechanism, or creating one.
* The smart contract configurations could be loaded statically from a JSON file instead of having them hardcoded.
* The application could be containerized for easier deployment.

## Takeaways

It was a very fun challenge, pushing me to learn new things about the decentralized web, fiddle with Etherscan, GraphQL, Infura, TheGraph, Compound, Solidity smart contracts, and Ethers.

Plus it's great to see how far Javascript has come since its earlier versions.
# Thought process

As part of developing this challenge, I will be writing down my thought process and timelines.

## Friday 07/01

In this day I have received the challenge. The main technologies are:

* Infura, for reliably connecting to Ethereum networks
* Typescript, for the underlying backend
* DynamoDB, for persisting
* GraphQL and Apollo, for querying TheGraph

Of these, I have only worked with Typescript, so most of the day was spent reading up on how to monitor smart contracts, setting up and playing with the Kovan network, using a faucet to get some KETH, understanding what role TheGraph fulfills in this challenge, and understanding what Compound does.

## Saturday 08/01

Today I'm doing development. I will begin by interacting with the Nest application locally, and getting Mint & Redeem events. 

I have decided that I will focus on monitoring the ethereum compound token for this challenge, which can be found at https://etherscan.io/address/0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5#code.

The events I'm interested in are defined in the smart contract in lines 939 & 944:

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

# Example Ethers.js API

This repo contains the solution to the given [backend task](https://abag-tasks.notion.site/abag-tasks/DeFi-Web2-Backend-4de68fc1b2854251a25a4f4de5ec0386) for the backend engineer role at Advanced Blockchain.

## Thought process

See [here](./Process.MD)

## Installation

```bash
$ npm install
```

## Running the app

```bash
# install DDB
$ npm run ddb:install

# start DDB
$ npm run ddb:start

# watch mode
$ npm run start:dev
```

## Trying the app

Use cURL, or any HTTP capable client.

Example request:

```
curl localhost:3000/collector/lastday/cDAI/Mint
```

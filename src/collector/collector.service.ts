import { Injectable, OnModuleInit } from '@nestjs/common';

import { ethers } from 'ethers';

import {
  ApolloClient,
  gql,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client/core';
import fetch from 'cross-fetch';
import { InjectModel, Model } from 'nestjs-dynamoose';
import { ChartService } from '../chart/chart.service';
import { Event, EventKey, Supply, SupplyKey } from './collector.interface';
import * as moment from 'moment'
import * as lodash from 'lodash';
import { ulid } from 'ulid';


//const getLatestIndexedBlock = `
//query {
//  indexingStatusForCurrentVersion(subgraphName: "graphprotocol/compound-v2") { chains { latestBlock { hash number }}}
//}
//`;

// TODO: Make sure this function is either never called with external input, or properly sanitized.
function  buildMintTokensQuery(symbol: string, from: number, to: number): string {
  return `
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
  }`
}

// TODO: Make sure this function is either never called with external input, or properly sanitized.
function  buildRedeemTokensQuery(symbol: string, from: number, to: number): string {
  return `
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
  }`
}

function partitionByHour(events: Array<CompoundEvent>): Array<SupplyDataPoint>{
  let groupedEvents = lodash.groupBy(events, event => moment.utc(event.blockTime * 1000).startOf('hour').unix());
  return lodash.map(groupedEvents, (events, hour) => {
    return {
      timestamp: parseInt(hour) * 1000,
      totalSupply: lodash.reduce(events, (sum, current) => {
        return sum + parseFloat(current.amount)
      }, 0)
    }
  });
}

enum CompoundTokenName {
  Eth = 'cETH'
}

const tokens: Array<string> = new Array('cETH', 'cDAI');

interface CompoundContractsConfig {
  TokenName: CompoundTokenName,
  Address: string,
  JSONABI: string,
}

interface TheGraphMintEventsResponse {
  mintEvents: Array<CompoundEvent>
}

interface TheGraphRedeemEventsResponse {
  redeemEvents: Array<CompoundEvent>
}

interface CompoundEvent {
  id: string,
  amount: string,
  to: string,
  from: string,
  blockNumber: number
  blockTime: number
  cTokenSymbol: string
  underlyingAmount: number
}

interface CompoundEventBucket {
  begin_time: number,
  end_time: number,
  events: Array<CompoundEvent>
}

interface SupplyDataPoint {
  timestamp: Number,
  totalSupply: Number,
}

const configs: Array<CompoundContractsConfig> = [
  {
    TokenName: CompoundTokenName.Eth,
    Address: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
    JSONABI: `[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"mint","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"reserveFactorMantissa","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"borrowBalanceCurrent","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"exchangeRateStored","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"pendingAdmin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"balanceOfUnderlying","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getCash","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newComptroller","type":"address"}],"name":"_setComptroller","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalBorrows","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"repayBorrow","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"comptroller","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"reduceAmount","type":"uint256"}],"name":"_reduceReserves","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"initialExchangeRateMantissa","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"accrualBlockNumber","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"totalBorrowsCurrent","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"redeemAmount","type":"uint256"}],"name":"redeemUnderlying","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalReserves","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"borrowBalanceStored","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"accrueInterest","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"borrowIndex","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"borrower","type":"address"},{"name":"cTokenCollateral","type":"address"}],"name":"liquidateBorrow","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"supplyRatePerBlock","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"liquidator","type":"address"},{"name":"borrower","type":"address"},{"name":"seizeTokens","type":"uint256"}],"name":"seize","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newPendingAdmin","type":"address"}],"name":"_setPendingAdmin","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"exchangeRateCurrent","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"getAccountSnapshot","outputs":[{"name":"","type":"uint256"},{"name":"","type":"uint256"},{"name":"","type":"uint256"},{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"borrowAmount","type":"uint256"}],"name":"borrow","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"redeemTokens","type":"uint256"}],"name":"redeem","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"borrower","type":"address"}],"name":"repayBorrowBehalf","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"_acceptAdmin","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newInterestRateModel","type":"address"}],"name":"_setInterestRateModel","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"interestRateModel","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"admin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"borrowRatePerBlock","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newReserveFactorMantissa","type":"uint256"}],"name":"_setReserveFactor","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"isCToken","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"comptroller_","type":"address"},{"name":"interestRateModel_","type":"address"},{"name":"initialExchangeRateMantissa_","type":"uint256"},{"name":"name_","type":"string"},{"name":"symbol_","type":"string"},{"name":"decimals_","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"interestAccumulated","type":"uint256"},{"indexed":false,"name":"borrowIndex","type":"uint256"},{"indexed":false,"name":"totalBorrows","type":"uint256"}],"name":"AccrueInterest","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"minter","type":"address"},{"indexed":false,"name":"mintAmount","type":"uint256"},{"indexed":false,"name":"mintTokens","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"redeemer","type":"address"},{"indexed":false,"name":"redeemAmount","type":"uint256"},{"indexed":false,"name":"redeemTokens","type":"uint256"}],"name":"Redeem","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"borrower","type":"address"},{"indexed":false,"name":"borrowAmount","type":"uint256"},{"indexed":false,"name":"accountBorrows","type":"uint256"},{"indexed":false,"name":"totalBorrows","type":"uint256"}],"name":"Borrow","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"payer","type":"address"},{"indexed":false,"name":"borrower","type":"address"},{"indexed":false,"name":"repayAmount","type":"uint256"},{"indexed":false,"name":"accountBorrows","type":"uint256"},{"indexed":false,"name":"totalBorrows","type":"uint256"}],"name":"RepayBorrow","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"liquidator","type":"address"},{"indexed":false,"name":"borrower","type":"address"},{"indexed":false,"name":"repayAmount","type":"uint256"},{"indexed":false,"name":"cTokenCollateral","type":"address"},{"indexed":false,"name":"seizeTokens","type":"uint256"}],"name":"LiquidateBorrow","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldPendingAdmin","type":"address"},{"indexed":false,"name":"newPendingAdmin","type":"address"}],"name":"NewPendingAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldAdmin","type":"address"},{"indexed":false,"name":"newAdmin","type":"address"}],"name":"NewAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldComptroller","type":"address"},{"indexed":false,"name":"newComptroller","type":"address"}],"name":"NewComptroller","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldInterestRateModel","type":"address"},{"indexed":false,"name":"newInterestRateModel","type":"address"}],"name":"NewMarketInterestRateModel","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldReserveFactorMantissa","type":"uint256"},{"indexed":false,"name":"newReserveFactorMantissa","type":"uint256"}],"name":"NewReserveFactor","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"admin","type":"address"},{"indexed":false,"name":"reduceAmount","type":"uint256"},{"indexed":false,"name":"newTotalReserves","type":"uint256"}],"name":"ReservesReduced","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"error","type":"uint256"},{"indexed":false,"name":"info","type":"uint256"},{"indexed":false,"name":"detail","type":"uint256"}],"name":"Failure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Approval","type":"event"}]`
  }
]

@Injectable()
export class CollectorService implements OnModuleInit {
  clientMetadata: ApolloClient<NormalizedCacheObject>;
  // add your own properties
  infuraProvider: ethers.providers.InfuraProvider;
  contractConnections: Map<CompoundTokenName, ethers.Contract>;

  constructor(
    @InjectModel('Event') private eventModel: Model<Event, EventKey>,
    @InjectModel('Supply') private supplyModel: Model<Supply, SupplyKey>,
    private readonly chartService: ChartService) {
    this.clientMetadata = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: 'https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2',
        fetch,
      }),
    });

    this.infuraProvider = new ethers.providers.InfuraProvider("homestead", "04cb01a02d6b4129824583cd60e78a12");
    this.contractConnections = new Map<CompoundTokenName, ethers.Contract>();
    for(let token in configs){
      let config = configs[token];
      this.contractConnections.set(config.TokenName, new ethers.Contract(config.Address, config.JSONABI, this.infuraProvider));
    }
  }

  onModuleInit() {
    // start events listers
    this.listenToEvents();
    
    
    // fetch data from compound's the graph
    this.fetchFromTheGraph();
  }

  async listenToEvents() {
    // start event listeners
    // Here we register listeners for both Mint and Redeem events.
    this.contractConnections.get(CompoundTokenName.Eth).on("Mint", (minter, mintAmount, mintTokens, event) => {
      console.log(`Mint Happened - minter: ${ minter }, mintAmount: ${ mintAmount }, mintTokens: ${ mintTokens}`);
      let eventToSave: Event = {
        address: minter,
        amount: Number(mintAmount),
        tokens: Number(mintTokens),
        timestamp: new Date(),
        event: 'Mint',
        id: ulid()
      }
      this.eventModel.create(eventToSave);
    });
    this.contractConnections.get(CompoundTokenName.Eth).on("Redeem", (redeemer, redeemAmount, redeemTokens, event) => {
      console.log(`Redeem Happened - redeemer: ${ redeemer }, redeemAmount: ${ redeemAmount }, redeemTokens: ${ redeemTokens}`);
      let eventToSave: Event = {
        address: redeemer,
        amount: Number(redeemAmount),
        tokens: Number(redeemTokens),
        timestamp: new Date(),
        event: 'Redeem',
        id: ulid()
      }
      this.eventModel.create(eventToSave);
    });
  }

  async fetchFromTheGraph() { 
    // Simplified example on how to get currently synced block number on compound's the graph.
    // This is useful for BONUS if you decide to update the data from the event listener.
    // You need to sychnronize the current blocks so no events are missed before GQL data is parsed
    // and listener started to listen.

    // Get current date in UTC
    let now_utc = moment().utc();
    // Go to day before
    let day_before = now_utc.clone();
    day_before.subtract(1,'d');
    // Get beginning and end of day before
    let beginning_day_before = day_before.clone().startOf('day');
    let beginning_today = now_utc.clone().startOf('day');

    // For debugging purposes
    console.log(`Beginning of day before parsed as: ${beginning_day_before.unix()}`);
    console.log(`Beginning of today parsed as: ${beginning_today.unix()}`);

    let mintEvents: Map<string, Array<CompoundEvent>> = new Map<CompoundTokenName, Array<CompoundEvent>>();
    let redeemEvents: Map<string, Array<CompoundEvent>> = new Map<CompoundTokenName, Array<CompoundEvent>>();
    // For each token, fetch mint and redeem events
    for(let tokenIndex in tokens){
      // Get token name as string
      const token = tokens[tokenIndex];
      try {

        // Query TheGraph for Mint events
        console.log(`Running TheGraph query for Mint events for token ${token}`);
        let mintEvents_response = await this.clientMetadata.query<TheGraphMintEventsResponse>({
          query: gql(buildMintTokensQuery(token, beginning_day_before.unix(), beginning_today.unix())),
        })
        // Set result array to mintEvents
        mintEvents.set(token, mintEvents_response.data.mintEvents);
        
        // Query TheGraph for Redeem events
        console.log(`Running TheGraph query for Redeem events for token ${token}`);
        let redeemEvents_response = await this.clientMetadata.query<TheGraphRedeemEventsResponse>({
          query: gql(buildRedeemTokensQuery(token, beginning_day_before.unix(), beginning_today.unix())),
        })
        // Set result array to redeemEvents
        redeemEvents.set(token, redeemEvents_response.data.redeemEvents);

      }catch(err){
        console.log('Error fetching data: ', err);
      }
    }

    // transform and save data from compound's the graph

    // only save if previous day not loaded
    // check whether we already have something stored for last day by scanning for already existing supply values
    let result = await this.supplyModel.scan().filter('timestamp').between(beginning_day_before.unix() * 1000, beginning_today.unix() * 1000).count().exec();
    let isPreviousDayUnsaved = (result.count === 0); // if we find 0 records for yesterday, trigger download again
    if(isPreviousDayUnsaved){
      console.log(`Saving yesterday's supply points to DynamoDB...`)
      for(let tokenIndex in tokens){
        // Get token name as string
        const token = tokens[tokenIndex];
        console.log(`Mint supply data for ${token}:`)
        let mintSupplyDataPoints = partitionByHour(mintEvents.get(token));
        let mintSupplyData: Array<Supply> = lodash.map(mintSupplyDataPoints, element => {
          return {
            timestamp: element.timestamp,
            totalSupply: element.totalSupply,
            event: 'Mint',
            id: ulid(),
            token: token,
          }
        });
        await this.supplyModel.batchPut(mintSupplyData);
        console.log(`Redeem supply data for ${token}:`)
        let redeemSupplyDataPoints = partitionByHour(redeemEvents.get(token));
        let redeemSupplyData: Array<Supply> = lodash.map(redeemSupplyDataPoints, element => {
          return {
            timestamp: element.timestamp,
            totalSupply: element.totalSupply,
            event: 'Redeem',
            id: ulid(),
            token: token,
          }
        });
        await this.supplyModel.batchPut(redeemSupplyData);
      }
    }
  }

  async fetchSupplyPointsLastDay(symbol: string, event: string): Promise<Array<Supply>> {
    // Get current date in UTC
    let now_utc = moment().utc();
    // Go to day before
    let day_before = now_utc.clone();
    day_before.subtract(1,'d');
    // Get beginning and end of day before
    let beginning_day_before = day_before.clone().startOf('day').unix() * 1000;
    let beginning_today = now_utc.clone().startOf('day').unix() * 1000;
    return await this.supplyModel.scan().filter('token').eq(symbol).filter('event').eq(event).filter('timestamp').between(beginning_day_before, beginning_today).exec();
  }

}

import { Controller, Get, Param } from '@nestjs/common';
import { Supply } from './collector.interface';
import { CollectorService } from './collector.service';
import * as lodash from 'lodash';

interface LastDaySupplyPoint {
    timestamp: Number,
    totalSupply: Number,
}

@Controller('collector')
export class CollectorController {

    constructor(private collectorService: CollectorService) {}

    @Get('/lastday/:token/:event', )
    async lastDaySupplyPoints(@Param('token') token: string, @Param('event') event: string): Promise<Array<LastDaySupplyPoint>> {
        let supplyPointsLastDay = await this.collectorService.fetchSupplyPointsLastDay(token, event);
        return lodash.map(supplyPointsLastDay, event => {
            let response_point: LastDaySupplyPoint = {
                timestamp: event.timestamp,
                totalSupply: event.totalSupply
            };
            return response_point
        }).sort((supplyPointA, supplyPointB) => {
            return (supplyPointA.timestamp.valueOf() - supplyPointB.timestamp.valueOf())
        });
    }
}

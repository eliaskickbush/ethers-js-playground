import { Controller, Get, Param } from '@nestjs/common';
import { Supply } from './collector.interface';
import { CollectorService } from './collector.service';


@Controller('collector')
export class CollectorController {

    constructor(private collectorService: CollectorService) {}

    @Get('/lastday/:token/:event', )
    async findAll(@Param('token') token: string, @Param('event') event: string): Promise<Array<Supply>> {
        return await this.collectorService.fetchSupplyPointsLastDay(token, event)
    }
}

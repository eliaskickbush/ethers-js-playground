import { Controller, Get } from '@nestjs/common';
import { CollectorService } from './collector.service';


@Controller('collector')
export class CollectorController {

    constructor(private collectorService: CollectorService) {}

    @Get('get-supply-points')
    findAll(): string {
        return 'This action returns all supply points';
    }
}

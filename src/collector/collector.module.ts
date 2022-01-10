import { Module } from '@nestjs/common';
import { ChartModule } from 'src/chart/chart.module';
import { CollectorService } from './collector.service';
import { DynamooseModule } from 'nestjs-dynamoose';
import { EventSchema, SupplySchema } from './collector.schema';
import { CollectorController } from './collector.controller';

@Module({
  imports: [ChartModule, DynamooseModule.forFeature([{name: 'Event', schema: EventSchema}, {name: 'Supply', schema: SupplySchema}])],
  providers: [CollectorService],
  exports: [],
  controllers: [CollectorController],
})
export class CollectorModule {}
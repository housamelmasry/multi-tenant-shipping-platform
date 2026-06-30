import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PdplController } from './pdpl.controller';
import { PdplService } from './pdpl.service';
import { StorageModule } from '@modules/storage/storage.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    StorageModule,
  ],
  controllers: [PdplController],
  providers: [PdplService],
  exports: [PdplService],
})
export class PdplModule {}

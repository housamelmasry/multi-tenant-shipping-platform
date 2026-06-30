import { Module } from '@nestjs/common';
import { PdplController } from './pdpl.controller';
import { PdplService } from './pdpl.service';

@Module({
  controllers: [PdplController],
  providers: [PdplService],
  exports: [PdplService],
})
export class PdplModule {}

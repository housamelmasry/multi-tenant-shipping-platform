import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global() // متاح في كل الـ modules بدون import
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

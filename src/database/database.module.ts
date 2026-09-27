import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global() // Available to all modules without an import.
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

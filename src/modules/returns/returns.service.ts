import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';

@Injectable()
export class ReturnsService {
  constructor(private db: DatabaseService) {}
}

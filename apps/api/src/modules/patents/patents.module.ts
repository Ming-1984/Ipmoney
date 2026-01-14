import { Module } from '@nestjs/common';

import { PatentsController } from './patents.controller';
import { PatentsService } from './patents.service';

@Module({
  controllers: [PatentsController],
  providers: [PatentsService],
})
export class PatentsModule {}


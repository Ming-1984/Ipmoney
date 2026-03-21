import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';
import { PatentsController } from './patents.controller';
import { PatentsService } from './patents.service';

@Module({
  imports: [FilesModule],
  controllers: [PatentsController],
  providers: [PatentsService],
})
export class PatentsModule {}

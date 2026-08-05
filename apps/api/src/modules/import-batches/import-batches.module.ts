import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';
import { ImportBatchesController } from './import-batches.controller';
import { ImportBatchesService } from './import-batches.service';

@Module({
  imports: [FilesModule],
  controllers: [ImportBatchesController],
  providers: [ImportBatchesService],
})
export class ImportBatchesModule {}

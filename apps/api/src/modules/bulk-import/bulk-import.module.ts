import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';

@Module({
  imports: [FilesModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}

import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileAccessGuard } from './file-access.guard';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FileAccessGuard],
  exports: [FilesService],
})
export class FilesModule {}

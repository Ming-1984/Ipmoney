import { Module } from '@nestjs/common';

import { AuditLogModule } from '../../common/audit-log.module';
import { FilesModule } from '../files/files.module';
import { DealRecordsController } from './deal-records.controller';
import { DealRecordsService } from './deal-records.service';

@Module({
  imports: [AuditLogModule, FilesModule],
  controllers: [DealRecordsController],
  providers: [DealRecordsService],
  exports: [DealRecordsService],
})
export class DealRecordsModule {}

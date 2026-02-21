import { Module } from '@nestjs/common';

import { PatentMaintenanceController } from './patent-maintenance.controller';
import { PatentMaintenanceService } from './patent-maintenance.service';

@Module({
  controllers: [PatentMaintenanceController],
  providers: [PatentMaintenanceService],
})
export class PatentMaintenanceModule {}

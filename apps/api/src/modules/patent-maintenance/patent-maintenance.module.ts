import { Module } from '@nestjs/common';

import { PatentMaintenanceController } from './patent-maintenance.controller';
import { PatentMaintenanceMeController } from './patent-maintenance.me.controller';
import { PatentMaintenanceService } from './patent-maintenance.service';

@Module({
  controllers: [PatentMaintenanceController, PatentMaintenanceMeController],
  providers: [PatentMaintenanceService],
})
export class PatentMaintenanceModule {}

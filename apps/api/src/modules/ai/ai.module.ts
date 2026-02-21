import { Module } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AdminAiController } from './admin-ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController, AdminAiController],
  providers: [AiService],
})
export class AiModule {}

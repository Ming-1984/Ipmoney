import { Global, Module } from '@nestjs/common';

import { ConfigModule } from '../modules/config/config.module';
import { ContentEventService } from './content-event.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ContentEventService],
  exports: [ContentEventService],
})
export class ContentEventModule {}

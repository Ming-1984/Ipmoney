import { Global, Module } from '@nestjs/common';

import { BearerAuthGuard } from './bearer-auth.guard';
import { VerifiedUserGuard } from './verified-user.guard';

@Global()
@Module({
  providers: [BearerAuthGuard, VerifiedUserGuard],
  exports: [BearerAuthGuard, VerifiedUserGuard],
})
export class GuardsModule {}

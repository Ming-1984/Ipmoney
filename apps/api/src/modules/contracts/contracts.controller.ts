import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ContractsService } from './contracts.service';

@Controller()
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/contracts')
  async list(@Req() req: any, @Query() query: any) {
    return await this.contracts.list(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/contracts/:contractId/upload')
  async upload(@Req() req: any, @Param('contractId') contractId: string, @Body() body: any) {
    return await this.contracts.upload(req, contractId, body || {});
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { PatentsService } from './patents.service';

@Controller('/patents')
export class PatentsController {
  constructor(private readonly patents: PatentsService) {}

  @Post('/normalize')
  async normalize(@Body() body: { raw?: string }) {
    return await this.patents.normalizeNumber(body?.raw);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/:patentId')
  async getById(@Param('patentId') patentId: string) {
    return await this.patents.getPatentById(patentId);
  }
}


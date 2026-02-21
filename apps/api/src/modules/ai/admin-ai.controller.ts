import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AiService } from './ai.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/ai')
export class AdminAiController {
  constructor(private readonly ai: AiService) {}

  @Get('/parse-results')
  async list(@Req() req: any, @Query() query: any) {
    return await this.ai.adminListParseResults(req, query || {});
  }

  @Get('/parse-results/:parseResultId')
  async getDetail(@Req() req: any, @Param('parseResultId') parseResultId: string) {
    return await this.ai.adminGetParseResult(req, parseResultId);
  }

  @Patch('/parse-results/:parseResultId')
  async update(
    @Req() req: any,
    @Param('parseResultId') parseResultId: string,
    @Body() body: any,
  ) {
    return await this.ai.adminUpdateParseResult(req, parseResultId, body || {});
  }
}

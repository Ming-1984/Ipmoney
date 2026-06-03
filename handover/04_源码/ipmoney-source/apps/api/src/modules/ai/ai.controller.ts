import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('/ai/agent/query')
  async createAgentQuery(@Body() body: any) {
    return await this.ai.createAgentQuery(body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/ai/parse-results/:parseResultId/feedback')
  async createFeedback(@Req() req: any, @Param('parseResultId') parseResultId: string, @Body() body: any) {
    return await this.ai.createFeedback(req, parseResultId, body || {});
  }
}

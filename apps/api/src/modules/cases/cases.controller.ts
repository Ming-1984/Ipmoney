import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { CasesService } from './cases.service';

@Controller()
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/cases')
  async list(@Req() req: any, @Query() query: any) {
    return await this.cases.list(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/cases/:caseId')
  async getDetail(@Req() req: any, @Param('caseId') caseId: string) {
    return await this.cases.getDetail(req, caseId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases')
  async create(@Req() req: any, @Body() body: any) {
    return await this.cases.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/assign')
  async assign(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    return await this.cases.assign(req, caseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/status')
  async updateStatus(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    return await this.cases.updateStatus(req, caseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/notes')
  async addNote(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    return await this.cases.addNote(req, caseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/evidence')
  async addEvidence(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    return await this.cases.addEvidence(req, caseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/sla')
  async updateSla(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    return await this.cases.updateSla(req, caseId, body || {});
  }
}

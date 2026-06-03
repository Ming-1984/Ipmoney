import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { CasesService } from './cases.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  private parseUuidParam(value: string, field: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return raw;
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/cases')
  async list(@Req() req: any, @Query() query: any) {
    return await this.cases.list(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/cases/:caseId')
  async getDetail(@Req() req: any, @Param('caseId') caseId: string) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.getDetail(req, normalizedCaseId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases')
  async create(@Req() req: any, @Body() body: any) {
    return await this.cases.create(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/assign')
  async assign(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.assign(req, normalizedCaseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/status')
  async updateStatus(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.updateStatus(req, normalizedCaseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/notes')
  async addNote(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.addNote(req, normalizedCaseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/evidence')
  async addEvidence(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.addEvidence(req, normalizedCaseId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/cases/:caseId/sla')
  async updateSla(@Req() req: any, @Param('caseId') caseId: string, @Body() body: any) {
    const normalizedCaseId = this.parseUuidParam(caseId, 'caseId');
    return await this.cases.updateSla(req, normalizedCaseId, body || {});
  }
}

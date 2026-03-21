import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { requirePermission } from '../../common/permissions';
import { PatentsService } from './patents.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class PatentsController {
  constructor(private readonly patents: PatentsService) {}

  private parseUuidParam(value: string, fieldName: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${fieldName} is invalid` });
    }
    return raw;
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents')
  async adminList(@Req() req: any, @Query() query: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.patents.adminList(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents')
  async adminCreate(@Req() req: any, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.patents.adminCreate(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/:patentId')
  async adminGetById(@Req() req: any, @Param('patentId') patentId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.read');
    return await this.patents.adminGetById(req, patentId);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/patents/:patentId')
  async adminUpdate(@Req() req: any, @Param('patentId') patentId: string, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'listing.audit');
    return await this.patents.adminUpdate(req, patentId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents/jobs/import')
  async createImportJob(@Req() req: any, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    return await this.patents.createImportJob(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents/jobs/import/:jobId/validate')
  async validateImportJob(@Req() req: any, @Param('jobId') jobId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    const normalizedJobId = this.parseUuidParam(jobId, 'jobId');
    return await this.patents.validateImportJob(req, normalizedJobId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents/jobs/import/:jobId/execute')
  async executeImportJob(@Req() req: any, @Param('jobId') jobId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    const normalizedJobId = this.parseUuidParam(jobId, 'jobId');
    return await this.patents.executeImportJob(req, normalizedJobId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/jobs/import')
  async listImportJobs(@Req() req: any, @Query() query: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    return await this.patents.listImportJobs(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/jobs/import/:jobId')
  async getImportJob(@Req() req: any, @Param('jobId') jobId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    const normalizedJobId = this.parseUuidParam(jobId, 'jobId');
    return await this.patents.getImportJob(req, normalizedJobId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/jobs/import/:jobId/rows')
  async listImportJobRows(@Req() req: any, @Param('jobId') jobId: string, @Query() query: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    const normalizedJobId = this.parseUuidParam(jobId, 'jobId');
    return await this.patents.listImportJobRows(req, normalizedJobId, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patents/jobs/import/:jobId/error-file')
  async getImportJobErrorFile(@Req() req: any, @Param('jobId') jobId: string) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    const normalizedJobId = this.parseUuidParam(jobId, 'jobId');
    return await this.patents.getImportJobErrorFile(req, normalizedJobId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patents/jobs/listings')
  async adminGenerateListings(@Req() req: any, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.import');
    return await this.patents.adminGenerateListings(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/me/patent-claims')
  async createMyClaim(@Req() req: any, @Body() body: any) {
    return await this.patents.createMyClaim(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/me/patent-claims')
  async listMyClaims(@Req() req: any, @Query() query: any) {
    return await this.patents.listMyClaims(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/patent-claims')
  async adminListClaims(@Req() req: any, @Query() query: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.claim.review');
    return await this.patents.adminListClaims(req, query || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patent-claims/:claimId/approve')
  async approveClaim(@Req() req: any, @Param('claimId') claimId: string, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.claim.review');
    const normalizedClaimId = this.parseUuidParam(claimId, 'claimId');
    return await this.patents.approveClaim(req, normalizedClaimId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/patent-claims/:claimId/reject')
  async rejectClaim(@Req() req: any, @Param('claimId') claimId: string, @Body() body: any) {
    this.patents.ensureAdmin(req);
    requirePermission(req, 'patent.claim.review');
    const normalizedClaimId = this.parseUuidParam(claimId, 'claimId');
    return await this.patents.rejectClaim(req, normalizedClaimId, body || {});
  }

  @Post('/patents/normalize')
  async normalize(@Body() body: { raw?: string }) {
    return await this.patents.normalizeNumber(body?.raw);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/patents/:patentId')
  async getById(@Param('patentId') patentId: string) {
    return await this.patents.getPatentById(patentId);
  }
}

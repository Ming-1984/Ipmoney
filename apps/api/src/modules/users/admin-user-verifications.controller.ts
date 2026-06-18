import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { ContentAuditService } from '../../common/content-audit.service';
import { requirePermission } from '../../common/permissions';
import { UsersService } from './users.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@UseGuards(BearerAuthGuard)
@Controller('/admin/user-verifications')
export class AdminUserVerificationsController {
  constructor(
    private readonly users: UsersService,
    private readonly contentAudit: ContentAuditService,
  ) {}

  private parseUuidParam(value: string, field: string): string {
    const raw = String(value || '').trim();
    if (!raw || !UUID_RE.test(raw)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: `${field} is invalid` });
    }
    return raw;
  }

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    requirePermission(req, 'verification.read');
    return await this.users.adminListUserVerifications(query || {});
  }

  @Post('/:verificationId/approve')
  async approve(@Req() req: any, @Param('verificationId') verificationId: string, @Body() body?: { comment?: string }) {
    requirePermission(req, 'verification.review');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    return await this.users.adminApproveVerification(normalizedVerificationId, body?.comment, req?.auth?.userId || '');
  }

  @Post('/:verificationId/reject')
  async reject(@Req() req: any, @Param('verificationId') verificationId: string, @Body() body: { reason: string }) {
    requirePermission(req, 'verification.review');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    return await this.users.adminRejectVerification(normalizedVerificationId, body?.reason, req?.auth?.userId || '');
  }

  @Patch('/:verificationId/logo')
  async updateLogo(
    @Req() req: any,
    @Param('verificationId') verificationId: string,
    @Body() body: { logoFileId?: string | null },
  ) {
    requirePermission(req, 'verification.review');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    if (!Object.prototype.hasOwnProperty.call(body || {}, 'logoFileId')) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'logoFileId is required' });
    }
    return await this.users.adminUpdateVerificationLogo(normalizedVerificationId, body?.logoFileId, req?.auth?.userId || '');
  }

  @Patch('/:verificationId/profile')
  async updateProfile(
    @Req() req: any,
    @Param('verificationId') verificationId: string,
    @Body() body: { displayName?: string | null; contactName?: string | null; regionCode?: string | null; intro?: string | null },
  ) {
    requirePermission(req, 'verification.review');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    return await this.users.adminUpdateVerificationProfile(normalizedVerificationId, body || {}, req?.auth?.userId || '');
  }

  @Get('/:verificationId/materials')
  async materials(@Req() req: any, @Param('verificationId') verificationId: string) {
    requirePermission(req, 'verification.read');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    return await this.contentAudit.listMaterials('VERIFICATION', normalizedVerificationId);
  }

  @Get('/:verificationId/audit-logs')
  async auditLogs(@Req() req: any, @Param('verificationId') verificationId: string) {
    requirePermission(req, 'auditLog.read');
    const normalizedVerificationId = this.parseUuidParam(verificationId, 'verificationId');
    return await this.contentAudit.listLogs('VERIFICATION', normalizedVerificationId);
  }
}

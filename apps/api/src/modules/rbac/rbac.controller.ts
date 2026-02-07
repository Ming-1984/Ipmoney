import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { RbacService } from './rbac.service';

@Controller()
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @UseGuards(BearerAuthGuard)
  @Get('/admin/rbac/roles')
  async listRoles(@Req() req: any) {
    return await this.rbac.listRoles(req);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/rbac/roles')
  async createRole(@Req() req: any, @Body() body: any) {
    return await this.rbac.createRole(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/rbac/roles/:roleId')
  async updateRole(@Req() req: any, @Param('roleId') roleId: string, @Body() body: any) {
    return await this.rbac.updateRole(req, roleId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Delete('/admin/rbac/roles/:roleId')
  async deleteRole(@Req() req: any, @Param('roleId') roleId: string) {
    return await this.rbac.deleteRole(req, roleId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/rbac/permissions')
  async listPermissions(@Req() req: any) {
    return await this.rbac.listPermissions(req);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/rbac/users')
  async listUsers(@Req() req: any) {
    return await this.rbac.listUsers(req);
  }

  @UseGuards(BearerAuthGuard)
  @Patch('/admin/rbac/users/:userId')
  async updateUserRoles(@Req() req: any, @Param('userId') userId: string, @Body() body: any) {
    return await this.rbac.updateUserRoles(req, userId, body || {});
  }
}

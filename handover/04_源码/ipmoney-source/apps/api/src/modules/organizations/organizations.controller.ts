import { Controller, Get, Param, Query } from '@nestjs/common';

import { OrganizationsService } from './organizations.service';

@Controller()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('/public/organizations')
  async list(@Query() query: any) {
    return await this.organizations.list(query);
  }

  @Get('/public/organizations/:orgUserId')
  async getById(@Param('orgUserId') orgUserId: string) {
    return await this.organizations.getById(orgUserId);
  }
}

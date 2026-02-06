import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { AddressesService } from './addresses.service';

@UseGuards(BearerAuthGuard)
@Controller()
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get('/me/addresses')
  async list(@Req() req: any) {
    return await this.addresses.list(req);
  }

  @Post('/me/addresses')
  async create(@Req() req: any, @Body() body: any) {
    return await this.addresses.create(req, body || {});
  }

  @Patch('/me/addresses/:addressId')
  async update(@Req() req: any, @Param('addressId') addressId: string, @Body() body: any) {
    return await this.addresses.update(req, addressId, body || {});
  }

  @Delete('/me/addresses/:addressId')
  async remove(@Req() req: any, @Param('addressId') addressId: string) {
    return await this.addresses.remove(req, addressId);
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { RegionsService } from './regions.service';

@UseGuards(BearerAuthGuard)
@Controller('/admin/industry-tags')
export class IndustryTagsController {
  constructor(private readonly regions: RegionsService) {}

  @Get()
  async list() {
    return await this.regions.listIndustryTags();
  }

  @Post()
  async create(@Body() body: { name: string }) {
    return await this.regions.createIndustryTag(body?.name);
  }
}


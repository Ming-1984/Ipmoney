import { Controller, Get, Query } from '@nestjs/common';

import { InventorsService } from './inventors.service';

@Controller()
export class InventorsController {
  constructor(private readonly inventors: InventorsService) {}

  @Get('/search/inventors')
  async search(@Query() query: any) {
    return await this.inventors.search(query);
  }
}

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { BearerAuthGuard } from '../../common/guards/bearer-auth.guard';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(BearerAuthGuard)
  @Post('/orders')
  async createOrder(@Req() req: any, @Body() body: { listingId?: string; artworkId?: string }) {
    return await this.orders.createOrder(req, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/orders')
  async listOrders(@Req() req: any, @Query() query: any) {
    return await this.orders.listOrders(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/orders/:orderId')
  async getOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.getOrderDetail(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/orders/:orderId/payment-intents')
  async createPaymentIntent(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() body: { payType?: string },
  ) {
    return await this.orders.createPaymentIntent(req, orderId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/orders/:orderId/case')
  async getCase(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.getCaseWithMilestones(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/orders/:orderId/refund-requests')
  async listRefunds(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.listRefundRequests(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/orders/:orderId/refund-requests')
  async createRefund(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.orders.createRefundRequest(req, orderId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/orders/:orderId/invoice')
  async getInvoice(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.getOrderInvoice(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/orders/:orderId/invoice-requests')
  async requestInvoice(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.requestInvoice(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/invoices')
  async listInvoices(@Req() req: any, @Query() query: any) {
    return await this.orders.listInvoices(req, query);
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/orders/:orderId')
  async getAdminOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.getAdminOrderDetail(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/orders/:orderId/milestones/contract-signed')
  async adminContractSigned(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.orders.adminContractSigned(req, orderId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/orders/:orderId/milestones/transfer-completed')
  async adminTransferCompleted(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.orders.adminTransferCompleted(req, orderId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Get('/admin/orders/:orderId/settlement')
  async getSettlement(@Req() req: any, @Param('orderId') orderId: string) {
    return await this.orders.getSettlement(req, orderId);
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/orders/:orderId/payouts/manual')
  async adminManualPayout(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.orders.adminManualPayout(req, orderId, body || {});
  }

  @UseGuards(BearerAuthGuard)
  @Post('/admin/orders/:orderId/invoice')
  async adminIssueInvoice(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return await this.orders.adminIssueInvoice(req, orderId, body || {});
  }
}

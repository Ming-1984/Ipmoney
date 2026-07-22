import { Controller, Get, Header } from '@nestjs/common';

const WECOM_DOMAIN_VERIFY_CONTENT = 'YpAqDE4xoAPsmGSK';

@Controller()
export class DomainVerificationController {
  @Get('/WW_verify_YpAqDE4xoAPsmGSK.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  getWecomDomainVerificationFile() {
    return WECOM_DOMAIN_VERIFY_CONTENT;
  }
}

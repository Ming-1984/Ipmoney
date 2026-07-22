import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DomainVerificationController } from '../src/domain-verification.controller';

describe('DomainVerificationController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DomainVerificationController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves WeCom domain verification file from the API root', async () => {
    const res = await request(app.getHttpServer()).get('/WW_verify_YpAqDE4xoAPsmGSK.txt').expect(200);

    expect(res.text).toBe('YpAqDE4xoAPsmGSK');
    expect(res.headers['content-type']).toContain('text/plain');
  });
});

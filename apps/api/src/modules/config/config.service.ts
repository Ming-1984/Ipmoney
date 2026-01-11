import { Injectable } from '@nestjs/common';
import { SystemConfigScope, SystemConfigValueType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type TradeRulesConfig = {
  version: number;
  depositRate: number;
  depositMinFen: number;
  depositMaxFen: number;
  depositFixedForNegotiableFen: number;
  autoRefundWindowMinutes: number;
  sellerMaterialDeadlineBusinessDays: number;
  contractSignedDeadlineBusinessDays: number;
  transferCompletedSlaDays: number;
  commissionRate: number;
  commissionMinFen: number;
  commissionMaxFen: number;
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED';
  payoutMethodDefault: 'MANUAL' | 'WECHAT';
  autoPayoutOnTimeout: boolean;
};

export type RecommendationConfig = {
  enabled: boolean;
  timeDecayHalfLifeHours: number;
  dedupeWindowHours: number;
  weights: { time: number; view: number; favorite: number; consult: number; region: number; user: number };
  featuredBoost: { province: number; city: number };
  updatedAt: string;
};

const KEY_TRADE_RULES = 'trade_rules';
const KEY_RECOMMENDATION = 'recommendation_config';

const DEFAULT_TRADE_RULES: TradeRulesConfig = {
  version: 1,
  depositRate: 0.05,
  depositMinFen: 10000,
  depositMaxFen: 500000,
  depositFixedForNegotiableFen: 20000,
  autoRefundWindowMinutes: 30,
  sellerMaterialDeadlineBusinessDays: 3,
  contractSignedDeadlineBusinessDays: 10,
  transferCompletedSlaDays: 90,
  commissionRate: 0.05,
  commissionMinFen: 100000,
  commissionMaxFen: 5000000,
  payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED',
  payoutMethodDefault: 'MANUAL',
  autoPayoutOnTimeout: false,
};

function buildDefaultRecommendation(): RecommendationConfig {
  return {
    enabled: true,
    timeDecayHalfLifeHours: 72,
    dedupeWindowHours: 24,
    weights: { time: 1, view: 1, favorite: 2, consult: 3, region: 2, user: 1 },
    featuredBoost: { province: 2, city: 3 },
    updatedAt: new Date().toISOString(),
  };
}

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureJsonConfig<T>(key: string, defaultValue: T) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (existing) return existing;

    return this.prisma.systemConfig.create({
      data: {
        key,
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(defaultValue),
        version: 1,
      },
    });
  }

  async getTradeRules(): Promise<TradeRulesConfig> {
    const row = await this.ensureJsonConfig(KEY_TRADE_RULES, DEFAULT_TRADE_RULES);

    try {
      const parsed = JSON.parse(row.value) as Partial<TradeRulesConfig>;
      return { ...DEFAULT_TRADE_RULES, ...parsed, version: row.version };
    } catch {
      return { ...DEFAULT_TRADE_RULES, version: row.version };
    }
  }

  async updateTradeRules(next: Omit<TradeRulesConfig, 'version'>): Promise<TradeRulesConfig> {
    const row = await this.ensureJsonConfig(KEY_TRADE_RULES, DEFAULT_TRADE_RULES);
    const version = row.version + 1;
    const payload: TradeRulesConfig = { ...next, version };

    const updated = await this.prisma.systemConfig.update({
      where: { key: KEY_TRADE_RULES },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version,
      },
    });

    return { ...payload, version: updated.version };
  }

  async getRecommendation(): Promise<RecommendationConfig> {
    const fallback = buildDefaultRecommendation();
    const row = await this.ensureJsonConfig(KEY_RECOMMENDATION, fallback);

    try {
      const parsed = JSON.parse(row.value) as Partial<RecommendationConfig>;
      return { ...fallback, ...parsed, updatedAt: parsed.updatedAt || row.updatedAt.toISOString() };
    } catch {
      return { ...fallback, updatedAt: row.updatedAt.toISOString() };
    }
  }

  async updateRecommendation(
    next: Omit<RecommendationConfig, 'updatedAt'>,
  ): Promise<RecommendationConfig> {
    const fallback = buildDefaultRecommendation();
    const row = await this.ensureJsonConfig(KEY_RECOMMENDATION, fallback);

    const updatedAt = new Date().toISOString();
    const payload: RecommendationConfig = { ...next, updatedAt };

    const updated = await this.prisma.systemConfig.update({
      where: { key: KEY_RECOMMENDATION },
      data: {
        valueType: SystemConfigValueType.JSON,
        scope: SystemConfigScope.GLOBAL,
        value: JSON.stringify(payload),
        version: row.version + 1,
      },
    });

    return { ...payload, updatedAt: updated.updatedAt.toISOString() };
  }
}

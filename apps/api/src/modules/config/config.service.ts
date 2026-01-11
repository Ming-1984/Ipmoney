import { Injectable } from '@nestjs/common';

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

@Injectable()
export class ConfigService {
  private tradeRules: TradeRulesConfig = {
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

  private recommendation: RecommendationConfig = {
    enabled: true,
    timeDecayHalfLifeHours: 72,
    dedupeWindowHours: 24,
    weights: { time: 1, view: 1, favorite: 2, consult: 3, region: 2, user: 1 },
    featuredBoost: { province: 2, city: 3 },
    updatedAt: new Date().toISOString(),
  };

  getTradeRules(): TradeRulesConfig {
    return this.tradeRules;
  }

  updateTradeRules(next: Omit<TradeRulesConfig, 'version'>): TradeRulesConfig {
    this.tradeRules = { ...next, version: this.tradeRules.version + 1 };
    return this.tradeRules;
  }

  getRecommendation(): RecommendationConfig {
    return this.recommendation;
  }

  updateRecommendation(next: Omit<RecommendationConfig, 'updatedAt'>): RecommendationConfig {
    this.recommendation = { ...next, updatedAt: new Date().toISOString() };
    return this.recommendation;
  }
}


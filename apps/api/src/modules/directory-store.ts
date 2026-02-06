import { randomUUID } from 'crypto';

export type OrganizationSummary = {
  userId: string;
  displayName: string;
  logoUrl?: string | null;
  regionCode?: string | null;
  tags?: string[] | null;
  summary?: string | null;
};

export type TechManagerSummary = {
  userId: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  regionCode?: string | null;
  rating?: number | null;
  years?: number | null;
  intro?: string | null;
  serviceTags?: string[] | null;
  featuredRank?: number | null;
  featuredUntil?: string | null;
  verificationStatus?: string | null;
  verificationType?: string | null;
  orgName?: string | null;
};

export type InventorRanking = {
  inventorName: string;
  patentCount: number;
  listingCount: number;
  location?: string | null;
  patentType?: string | null;
  tags?: string[] | null;
};

export const ORGANIZATIONS: OrganizationSummary[] = [
  {
    userId: randomUUID(),
    displayName: '广东工业大学',
    logoUrl: null,
    regionCode: '440300',
    tags: ['高校', '材料'],
    summary: '高校成果转化与专利许可服务',
  },
  {
    userId: randomUUID(),
    displayName: '海南大学',
    logoUrl: null,
    regionCode: '460100',
    tags: ['高校', '农业'],
    summary: '产学研协同创新平台',
  },
];

export const TECH_MANAGERS: TechManagerSummary[] = [
  {
    userId: randomUUID(),
    nickname: '张经理',
    avatarUrl: null,
    regionCode: '110000',
    rating: 4.8,
    years: 6,
    intro: '擅长专利交易与成果转化。',
    serviceTags: ['专利交易', '成果转化'],
    verificationStatus: 'APPROVED',
    verificationType: 'TECH_MANAGER',
    orgName: '北京科技服务中心',
  },
  {
    userId: randomUUID(),
    nickname: '李经理',
    avatarUrl: null,
    regionCode: '440300',
    rating: 4.5,
    years: 4,
    intro: '聚焦高校成果对接。',
    serviceTags: ['高校成果', '投融资'],
    verificationStatus: 'APPROVED',
    verificationType: 'TECH_MANAGER',
    orgName: '深圳知识产权中心',
  },
];

export const INVENTORS: InventorRanking[] = [
  { inventorName: '王伟', patentCount: 32, listingCount: 5, location: '北京', patentType: 'INVENTION' },
  { inventorName: '李娜', patentCount: 24, listingCount: 3, location: '深圳', patentType: 'UTILITY_MODEL' },
  { inventorName: '张强', patentCount: 18, listingCount: 2, location: '广州', patentType: 'DESIGN' },
];

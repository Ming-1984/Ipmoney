import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PatentPartyRole } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type PatentNumberInputType = 'APPLICATION_NO' | 'PATENT_NO' | 'PUBLICATION_NO';

type PatentNormalizeResponseDto = {
  jurisdiction: 'CN';
  inputType: PatentNumberInputType;
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  publicationNoNorm?: string;
  publicationNoDisplay?: string;
  patentNoNorm?: string;
  patentNoDisplay?: string;
  kindCode?: string;
  patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  warnings?: string[];
};

type PatentDto = {
  id: string;
  jurisdiction: 'CN';
  applicationNoNorm: string;
  applicationNoDisplay?: string;
  patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  title: string;
  abstract?: string;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
  sourcePrimary?: 'USER' | 'ADMIN' | 'PROVIDER';
  sourceUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type LegalStatusDto = NonNullable<PatentDto['legalStatus']>;

function toHalfWidth(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code === 0x3000) {
      out += ' ';
      continue;
    }
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0);
      continue;
    }
    out += ch;
  }
  return out;
}

function cleanRaw(raw: string): string {
  let s = toHalfWidth(String(raw || '')).trim();
  s = s.toUpperCase();
  s = s.replace(/(专利申请号|专利号|申请号|公开号|公告号|公开\(公告\)号)/g, '');
  s = s.replace(/[:：]/g, '');
  s = s.replace(/[\s\-_，,、；;（）()【】\[\]]/g, '');
  return s;
}

function digitToPatentType(typeDigit: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  if (typeDigit === '1') return 'INVENTION';
  if (typeDigit === '2') return 'UTILITY_MODEL';
  if (typeDigit === '3') return 'DESIGN';
  return null;
}

function kindToPatentType(kind: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  const k = String(kind || '').toUpperCase();
  if (k.startsWith('U')) return 'UTILITY_MODEL';
  if (k.startsWith('S')) return 'DESIGN';
  if (k.startsWith('A') || k.startsWith('B')) return 'INVENTION';
  return null;
}

function toApplicationDisplay(normDigits: string): string {
  const d = String(normDigits || '').replace(/\D/g, '');
  if (d.length < 2) return d;
  return `${d.slice(0, -1)}.${d.slice(-1)}`;
}

@Injectable()
export class PatentsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeNumber(raw?: string): PatentNormalizeResponseDto {
    const cleaned = cleanRaw(String(raw || ''));
    if (!cleaned) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'raw 不能为空' });

    const warnings: string[] = [];

    const isPatentNo = cleaned.startsWith('ZL') || cleaned.startsWith('CNZL');
    const withoutPrefix = cleaned.replace(/^CN/, '').replace(/^ZL/, '');
    const digits = withoutPrefix.replace(/\./g, '');

    if (/^(19\d{2}|20\d{2})[123]\d{7}\d$/.test(digits) || /^\d{2}[123]\d{5}\d$/.test(digits)) {
      const typeDigit = digits.startsWith('19') || digits.startsWith('20') ? digits.slice(4, 5) : digits.slice(2, 3);
      const patentType = digitToPatentType(typeDigit);
      if (!patentType) warnings.push('无法从号码类型位推断专利类型');

      const applicationNoNorm = digits;
      const applicationNoDisplay = toApplicationDisplay(digits);

      const out: PatentNormalizeResponseDto = {
        jurisdiction: 'CN',
        inputType: isPatentNo ? 'PATENT_NO' : 'APPLICATION_NO',
        applicationNoNorm,
        applicationNoDisplay,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };

      if (isPatentNo) {
        out.patentNoNorm = `ZL${applicationNoNorm}`;
        out.patentNoDisplay = `ZL${applicationNoDisplay}`;
      }

      return out;
    }

    const pubMatch = cleaned.match(/^(?:CN)?(\d{7,9})([A-Z]\d?)$/);
    if (pubMatch) {
      const number = pubMatch[1];
      const kindCode = pubMatch[2];
      const publicationNoNorm = `CN${number}${kindCode}`;
      const patentType = kindToPatentType(kindCode);
      if (!patentType) warnings.push('无法从文献种类代码推断专利类型（以数据源为准）');
      return {
        jurisdiction: 'CN',
        inputType: 'PUBLICATION_NO',
        publicationNoNorm,
        publicationNoDisplay: publicationNoNorm,
        kindCode,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };
    }

    throw new BadRequestException({ code: 'BAD_REQUEST', message: '无法识别专利号码格式' });
  }

  async getPatentById(patentId: string): Promise<PatentDto> {
    const p = await this.prisma.patent.findUnique({
      where: { id: String(patentId) },
      include: { parties: true },
    });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: '专利不存在' });

    const inventorNames = p.parties.filter((x) => x.role === PatentPartyRole.INVENTOR).map((x) => x.name);
    const assigneeNames = p.parties.filter((x) => x.role === PatentPartyRole.ASSIGNEE).map((x) => x.name);
    const applicantNames = p.parties.filter((x) => x.role === PatentPartyRole.APPLICANT).map((x) => x.name);

    const toDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
    const toDateTime = (d?: Date | null) => (d ? d.toISOString() : undefined);
    const legal = p.legalStatus ? String(p.legalStatus).toUpperCase() : '';
    const legalStatus =
      legal && ['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'].includes(legal)
        ? (legal as LegalStatusDto)
        : undefined;

    return {
      id: p.id,
      jurisdiction: 'CN',
      applicationNoNorm: p.applicationNoNorm,
      applicationNoDisplay: p.applicationNoDisplay ?? undefined,
      patentType: p.patentType,
      title: p.title,
      abstract: p.abstract ?? undefined,
      inventorNames: inventorNames.length ? inventorNames : undefined,
      assigneeNames: assigneeNames.length ? assigneeNames : undefined,
      applicantNames: applicantNames.length ? applicantNames : undefined,
      filingDate: toDate(p.filingDate),
      publicationDate: toDate(p.publicationDate),
      grantDate: toDate(p.grantDate),
      legalStatus,
      sourcePrimary: p.sourcePrimary,
      sourceUpdatedAt: toDateTime(p.sourceUpdatedAt),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
